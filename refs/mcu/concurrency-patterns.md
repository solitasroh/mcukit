# MCU Concurrency Hazard Pattern Library

> Reference for mcu-critical-analyzer agent (ConSynergy Stage 3: Reason)
> Sources: SDRacer, IntRace, SADA, MISRA C:2023, SEI CERT, ARM Cortex-M

---

## Pattern Index

| ID | Name | Severity | Confidence |
|----|------|----------|------------|
| CP-01 | ISR Unprotected Global Write | Critical | High |
| CP-02 | Volatile Synchronization Misuse | Critical | High |
| CP-03 | ISR Non-Reentrant Call | Critical | High |
| CP-04 | DMA Memory Barrier Missing | Warning | High |
| CP-05 | NVIC Same-Priority Contention | Warning | Medium |
| CP-06 | Non-Atomic Read-Modify-Write | Critical | High |
| CP-07 | Context Switch Critical Section Leak | Critical | High |
| CP-08 | DMA Buffer Cache Alignment | Warning | High |
| CP-09 | Stack Overflow Risk | Warning | Medium |
| CP-10 | Atomic Initialization Missing | Warning | Medium |
| CP-11 | Long ISR Execution | Warning | Medium |
| CP-12 | Shared Flag Without Protection | Critical | High |

---

## CP-01: ISR Unprotected Global Write

**Severity**: Critical | **Confidence**: High
**Reference**: SDRacer (IEEE 2020), MISRA C:2023 Directive 5.1

**Description**: ISR writes to a global variable that is also accessed from main/task context without critical section protection or interrupt disabling.

**Detection**:
- Global variable appears in both ISR handler and non-ISR function
- No `__disable_irq()` / `critical_enter()` / mutex around non-ISR access

**Dangerous Pattern**:
```c
volatile uint32_t g_counter;  // volatile alone is NOT sufficient

void TIM2_IRQHandler(void) {
    g_counter++;  // ISR writes
}

void main_loop(void) {
    uint32_t val = g_counter;  // main reads — RACE if >8-bit on Cortex-M0
}
```

**Fix**: Use atomic operations or disable interrupts around access:
```c
void main_loop(void) {
    __disable_irq();
    uint32_t val = g_counter;
    __enable_irq();
}
```

---

## CP-02: Volatile Synchronization Misuse

**Severity**: Critical | **Confidence**: High
**Reference**: SEI CERT CON02-C, MISRA C:2023 Rule 22.15

**Description**: `volatile` is used as the sole synchronization mechanism for multi-byte shared variables. `volatile` prevents compiler optimization but does NOT guarantee atomicity or memory ordering.

**Detection**:
- Variable declared `volatile` but no surrounding mutex/critical section
- Variable size > architecture word size (>32-bit on Cortex-M)
- Or: multi-step read-modify-write on any volatile variable

**Dangerous Pattern**:
```c
volatile uint64_t g_timestamp;  // 64-bit on 32-bit MCU — NOT atomic

void SysTick_Handler(void) {
    g_timestamp++;  // Two 32-bit operations, can be interrupted mid-update
}
```

**Fix**: Use critical section or split into two 32-bit values with sequence counter.

---

## CP-03: ISR Non-Reentrant Call

**Severity**: Critical | **Confidence**: High
**Reference**: MISRA C:2023 Amendment 4, Rule 22.x

**Description**: ISR calls a function that is not reentrant (uses static buffers, global state, or heap allocation).

**Detection**:
- ISR call graph contains: `malloc`, `free`, `printf`, `sprintf`, `snprintf`, `fprintf`
- ISR call graph contains: `strtok`, `strerror`, `localtime`, `asctime`, `rand`, `srand`
- ISR call graph contains: `HAL_Delay`, `osDelay`, any blocking function

**Non-Reentrant Function List**:
```
malloc, calloc, realloc, free
printf, fprintf, sprintf, snprintf, vprintf, vfprintf, vsprintf
scanf, fscanf, sscanf
strtok, strerror, asctime, ctime, localtime, gmtime
rand, srand
exit, abort, atexit
setjmp, longjmp
signal
```

---

## CP-04: DMA Memory Barrier Missing

**Severity**: Warning | **Confidence**: High
**Reference**: ARM Cortex-M Technical Reference, SADA (USENIX 2021)

**Description**: After DMA transfer complete callback, CPU accesses the DMA buffer without issuing a data memory barrier (DMB) or data synchronization barrier (DSB).

**Detection**:
- DMA complete callback (`HAL_*_RxCpltCallback`, `DMA*_IRQHandler`) accesses DMA buffer
- No `__DMB()`, `__DSB()`, or `SCB_CleanDCache_by_Addr()` before access

**Dangerous Pattern**:
```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    // DMA just filled rx_buffer, but cache may be stale on Cortex-M7
    process_data(rx_buffer);  // May read old cached data!
}
```

**Fix** (Cortex-M7 with D-Cache):
```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    SCB_InvalidateDCache_by_Addr(rx_buffer, sizeof(rx_buffer));
    process_data(rx_buffer);
}
```

---

## CP-05: NVIC Same-Priority Contention

**Severity**: Warning | **Confidence**: Medium
**Reference**: ARM Cortex-M NVIC specification

**Description**: Two ISRs with the same preemption priority access a shared resource. On Cortex-M, same-priority ISRs cannot preempt each other but can still contend if one is pending while the other runs.

**Detection**:
- Two NVIC entries with same preemptPriority
- Both ISR handlers access the same global variable
- No protection mechanism between them

---

## CP-06: Non-Atomic Read-Modify-Write

**Severity**: Critical | **Confidence**: High
**Reference**: MISRA C:2023 Rule 22.11-22.20

**Description**: A shared variable undergoes non-atomic read-modify-write (e.g., `x++`, `x |= flag`, `x &= ~mask`) without protection. The operation compiles to multiple instructions and can be interrupted.

**Detection**:
- Shared variable (ISR+main or multi-task) with `++`, `--`, `+=`, `-=`, `|=`, `&=`, `^=`
- No surrounding critical section or atomic operation

**Dangerous Pattern**:
```c
volatile uint32_t g_flags;

void EXTI0_IRQHandler(void) { g_flags |= FLAG_A; }  // RMW: LDR, ORR, STR
void main_loop(void)        { g_flags &= ~FLAG_A; }  // RMW: LDR, BIC, STR
// If interrupt fires between LDR and STR in main, FLAG_A write is lost
```

---

## CP-07: Context Switch Critical Section Leak

**Severity**: Critical | **Confidence**: High
**Reference**: ConSynergy (2025)

**Description**: A lock (mutex/critical section) is acquired but not released before a context switch point (scheduler yield, task switch). This can cause deadlock or priority inversion.

**Detection**:
- `sync-enter` call found without matching `sync-exit` before context switch point
- Function contains both sync primitive and context switch call

---

## CP-08: DMA Buffer Cache Alignment

**Severity**: Warning | **Confidence**: High
**Reference**: SADA (USENIX 2021), ARM Cortex-M7 TRM

**Description**: DMA buffer is not aligned to cache line boundary (typically 32 bytes on Cortex-M7). Unaligned DMA buffers can cause cache coherency issues when CPU and DMA access adjacent memory.

**Detection**:
- DMA buffer declaration without `__attribute__((aligned(32)))` or `__ALIGN_BEGIN`
- MCU has D-Cache (Cortex-M7, Cortex-M55)

---

## CP-09: Stack Overflow Risk

**Severity**: Warning | **Confidence**: Medium
**Reference**: awesome-claude-code-subagents (25% headroom rule)

**Description**: A function or task's stack usage exceeds 75% of allocated stack size, leaving insufficient headroom for ISR nesting and worst-case paths.

**Detection**:
- .su file stack usage > 75% of linker-allocated stack
- Deep call chain with large local variables
- Recursive function calls

**Threshold**: Stack usage > 75% of allocated = Warning, > 90% = Critical

---

## CP-10: Atomic Initialization Missing

**Severity**: Warning | **Confidence**: Medium
**Reference**: MISRA C:2023 Rule 9.7

**Description**: C11 `_Atomic` variable is used without proper initialization via `ATOMIC_VAR_INIT` or `atomic_init`.

**Detection**:
- `_Atomic` or `atomic_*` type declaration without initializer
- No subsequent `atomic_init()` call before first use

---

## CP-11: Long ISR Execution

**Severity**: Warning | **Confidence**: Medium
**Reference**: AI-Assisted Debugging 2026

**Description**: ISR contains patterns suggesting long execution time: loops, delay functions, complex computations, or multiple function calls.

**Detection**:
- ISR body contains `for`, `while`, `do` loops
- ISR body contains `HAL_Delay`, `__NOP` loops, busy-wait
- ISR call graph depth > 3

---

## CP-12: Shared Flag Without Protection

**Severity**: Critical | **Confidence**: High
**Reference**: IntRace (2024)

**Description**: A boolean/flag variable shared between tasks/ISR is accessed without any synchronization. Even single-byte flags can cause logic errors if the compiler reorders or optimizes accesses.

**Detection**:
- Variable of type `bool`, `uint8_t`, or `_Bool` accessed from multiple contexts
- No volatile qualifier AND no synchronization primitive
- Or: volatile but used in compound condition (`if (flag_a && flag_b)`) without atomic snapshot
