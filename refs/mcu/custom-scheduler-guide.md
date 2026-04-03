# Custom Scheduler Pattern Guide

> Template for teams using custom (non-FreeRTOS) schedulers.
> Fill in your scheduler's API to enable mcu-critical-analyzer detection.
>
> Used by: concurrency-extractor.js (pattern matching), mcu-critical-analyzer (reasoning)

---

## Scheduler API

> Replace with your actual scheduler function names.

| Function | Type | Description |
|----------|------|-------------|
| `scheduler_yield()` | context-switch | Task yield, triggers context switch |
| `scheduler_start()` | context-switch | Start scheduler (initial context switch) |
| `task_create(fn, stack, prio)` | task-create | Create new task |
| `task_delete(id)` | task-delete | Delete task |
| `mutex_lock(m)` | sync-enter | Acquire mutex (blocking) |
| `mutex_unlock(m)` | sync-exit | Release mutex |
| `mutex_trylock(m)` | sync-enter | Try acquire mutex (non-blocking) |
| `critical_enter()` | sync-enter | Enter critical section (disable IRQ) |
| `critical_exit()` | sync-exit | Exit critical section (restore IRQ) |
| `sem_wait(s)` | sync-enter | Wait on semaphore (blocking) |
| `sem_post(s)` | sync-exit | Signal semaphore |
| `irq_disable()` | sync-enter | Globally disable interrupts |
| `irq_enable()` | sync-exit | Globally enable interrupts |

---

## Pattern Matching Rules

> These patterns are used by concurrency-extractor.js for regex matching.
> Format: `{type: "category", pattern: "regex_pattern"}`

### Synchronization Primitives

```yaml
syncPatterns:
  # Mutex
  - {type: "sync-enter", pattern: "mutex_lock\\s*\\("}
  - {type: "sync-exit",  pattern: "mutex_unlock\\s*\\("}
  - {type: "sync-enter", pattern: "mutex_trylock\\s*\\("}

  # Critical Section
  - {type: "sync-enter", pattern: "critical_enter\\s*\\("}
  - {type: "sync-exit",  pattern: "critical_exit\\s*\\("}

  # Interrupt Control
  - {type: "sync-enter", pattern: "__disable_irq\\s*\\("}
  - {type: "sync-exit",  pattern: "__enable_irq\\s*\\("}
  - {type: "sync-enter", pattern: "irq_disable\\s*\\("}
  - {type: "sync-exit",  pattern: "irq_enable\\s*\\("}

  # Semaphore
  - {type: "sync-enter", pattern: "sem_wait\\s*\\("}
  - {type: "sync-exit",  pattern: "sem_post\\s*\\("}

  # HAL-level (STM32)
  - {type: "sync-enter", pattern: "__HAL_LOCK\\s*\\("}
  - {type: "sync-exit",  pattern: "__HAL_UNLOCK\\s*\\("}

  # CMSIS-RTOS (if used)
  - {type: "sync-enter", pattern: "osMutexAcquire\\s*\\("}
  - {type: "sync-exit",  pattern: "osMutexRelease\\s*\\("}
```

### Context Switch Points

```yaml
switchPatterns:
  - "scheduler_yield\\s*\\("
  - "scheduler_start\\s*\\("
  - "task_switch\\s*\\("
  - "osThreadYield\\s*\\("
  - "taskYIELD\\s*\\("
  - "vTaskDelay\\s*\\("
  - "osDelay\\s*\\("
  - "SVC_Handler"
  - "PendSV_Handler"
```

### Task Creation Points

```yaml
taskPatterns:
  - "task_create\\s*\\("
  - "osThreadNew\\s*\\("
  - "xTaskCreate\\s*\\("
```

---

## Non-Reentrant Functions (Banned in ISR)

```
# Memory allocation
malloc, calloc, realloc, free

# Formatted I/O
printf, fprintf, sprintf, snprintf, vprintf, vfprintf, vsprintf, vsnprintf
scanf, fscanf, sscanf

# String (with internal state)
strtok

# Time (static buffers)
asctime, ctime, localtime, gmtime

# Other
rand, srand, strerror, exit, abort, atexit
setjmp, longjmp, signal

# Blocking HAL calls
HAL_Delay, osDelay, vTaskDelay
```

---

## How to Customize

1. Edit the tables and YAML blocks above to match your scheduler API
2. Save this file — mcu-critical-analyzer will read it during analysis
3. No code changes needed — patterns are loaded at analysis time

### Example: Adding a custom spinlock

```yaml
# Add to syncPatterns:
  - {type: "sync-enter", pattern: "spin_lock\\s*\\("}
  - {type: "sync-exit",  pattern: "spin_unlock\\s*\\("}
```
