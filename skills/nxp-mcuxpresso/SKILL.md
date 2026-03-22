---
name: nxp-mcuxpresso
classification: capability
deprecation-risk: low
domain: mcu
platforms: [nxp-k]
description: |
  NXP MCUXpresso SDK 드라이버 패턴 가이드. fsl_* API, board.h 구조, clock_config.
  Triggers: NXP, MCUXpresso, Kinetis, fsl_, MCU-Link
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
imports:
  - ${PLUGIN_ROOT}/refs/nxp-k/sdk-patterns.md
pdca-phase: do
---

# NXP MCUXpresso SDK Guide

## Project Structure
```
/board/     - board.c/h, pin_mux.c/h, clock_config.c/h, peripherals.c/h
/source/    - main.c, application code
/drivers/   - fsl_uart.c/h, fsl_gpio.c/h, fsl_spi.c/h (SDK drivers)
/CMSIS/     - core_cm4.h etc.
/device/    - MK64F12.h, system_MK64F12.c, startup
/utilities/ - fsl_debug_console.c/h
```

## Init Sequence
```c
BOARD_InitBootPins();       // pin_mux.c - pin configuration
BOARD_InitBootClocks();     // clock_config.c - clock setup
BOARD_InitDebugConsole();   // debug UART setup
```

## Key API Patterns

### UART
```c
uart_config_t config;
UART_GetDefaultConfig(&config);
config.baudRate_Bps = 115200;
UART_Init(UART0, &config, CLOCK_GetFreq(kCLOCK_BusClk));
UART_WriteBlocking(UART0, data, len);
UART_ReadBlocking(UART0, data, len);
```

### GPIO
```c
gpio_pin_config_t pinConfig = { kGPIO_DigitalOutput, 0 };
GPIO_PinInit(GPIOB, 22U, &pinConfig);
GPIO_PinWrite(GPIOB, 22U, 1U);   // Set high
GPIO_PinRead(GPIOB, 22U);        // Read
```

## Important Notes
- Header convention: `fsl_*.h` (NOT sdk_config.h, that's Nordic nRF)
- Device registers: `fsl_device_registers.h` includes chip-specific CMSIS header
- Newer devices may use `fsl_lpuart.h` instead of `fsl_uart.h`
