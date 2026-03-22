---
name: stm32-hal
classification: capability
classification-reason: "STM32 HAL/LL API pattern guide, may become internalized as models improve"
deprecation-risk: low
domain: mcu
platforms: [stm32]
description: |
  STM32 HAL/LL API 사용 가이드 및 베스트 프랙티스.
  CubeMX 코드 생성 후 수정 가이드, HAL 콜백 패턴, LL API 전환 기준.

  Triggers: STM32, HAL, LL, CubeMX, Cortex-M, stm32f4, stm32h7,
  STM32 개발, STM32開発, STM32开发, desarrollo STM32
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
imports:
  - ${PLUGIN_ROOT}/refs/stm32/hal-patterns.md
next-skill: communication
pdca-phase: do
task-template: "[MCU] {feature} - STM32 HAL"
---

# STM32 HAL/LL API Guide

## 1. Project Structure (CubeMX Generated)

```
Core/
├── Inc/           # Headers (main.h, stm32f4xx_hal_conf.h, stm32f4xx_it.h)
├── Src/           # Sources (main.c, stm32f4xx_hal_msp.c, stm32f4xx_it.c)
└── Startup/       # startup_stm32f407xx.s
Drivers/
├── STM32F4xx_HAL_Driver/   # HAL/LL source
└── CMSIS/                  # CMSIS Core + Device headers
Middlewares/                # FreeRTOS, USB, LwIP etc. (if enabled)
```

## 2. Initialization Sequence

```c
int main(void) {
  HAL_Init();                    // SysTick, Flash prefetch, NVIC group
  SystemClock_Config();          // RCC configuration (from CubeMX)
  MX_GPIO_Init();                // GPIO pin configuration
  MX_USART1_UART_Init();        // Peripheral init (CubeMX generated)
  // ... user code ...
}
```

**CubeMX User Code Sections**: Always write code between `/* USER CODE BEGIN */` and `/* USER CODE END */` markers. Code outside these sections will be overwritten on regeneration.

## 3. HAL API Patterns

### UART (Polling / IT / DMA)
```c
// Polling (blocking)
HAL_UART_Transmit(&huart1, data, len, timeout);
HAL_UART_Receive(&huart1, data, len, timeout);

// Interrupt (non-blocking)
HAL_UART_Transmit_IT(&huart1, data, len);
HAL_UART_Receive_IT(&huart1, data, len);

// DMA (most efficient)
HAL_UART_Transmit_DMA(&huart1, data, len);
HAL_UART_Receive_DMA(&huart1, data, len);

// Callback (override weak function)
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart) {
  if (huart == &huart1) { /* TX done */ }
}
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
  if (huart == &huart1) { /* RX done, restart */ }
}
```

### SPI
```c
HAL_SPI_TransmitReceive(&hspi1, txData, rxData, len, timeout);
HAL_SPI_TransmitReceive_DMA(&hspi1, txData, rxData, len);
```

### I2C
```c
HAL_I2C_Master_Transmit(&hi2c1, devAddr << 1, data, len, timeout);
HAL_I2C_Mem_Read(&hi2c1, devAddr << 1, regAddr, I2C_MEMADD_SIZE_8BIT, data, len, timeout);
```

### Error Handling
```c
HAL_StatusTypeDef status = HAL_UART_Transmit(&huart1, data, len, 100);
if (status != HAL_OK) {
  if (status == HAL_TIMEOUT) { /* handle timeout */ }
  if (status == HAL_ERROR)   { /* handle error */ }
  if (status == HAL_BUSY)    { /* handle busy */ }
}
```

## 4. HAL vs LL Decision

| Criteria | HAL | LL |
|----------|-----|-----|
| Ease of use | Easy (high abstraction) | Complex (register-level) |
| Code size | Larger | Smaller |
| Performance | Slower (function call overhead) | Faster (inline) |
| When to use | General development | Timing-critical, size-constrained |

## 5. Common Pitfalls

- **HAL_Delay in ISR**: Never call HAL_Delay() inside interrupt handler (SysTick blocked)
- **DMA memory alignment**: DMA buffers should be aligned and not in stack
- **Clock enable**: Peripheral clock must be enabled before configuration (CubeMX handles this in MSP)
- **NVIC priority**: FreeRTOS requires configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY consideration
