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
grandfathered: true
---
## 0. 문서 구조 (본 SKILL의 세 층)

1. **도메인 본문 (§1 ~ §N)**: 이 SKILL의 프로토콜.
   **grandfathered SKILL** — 잠금 어휘 사용 허용 (Cycle 3 변환). 본문 자체가 도메인 기술입니다.
2. **방법론 본문 — 도메인 중립 (선택)**: 공통 방법론 절이 있다면 `<!-- BEGIN: cycle3-body-neutral -->` 마커로 분리.
3. **도메인 예시 부록 (§A)**: SoT(`policies/locked-vocab.json`)에서 자동 생성.

직접 부록을 편집하지 마세요 — `node scripts/gen-locked-vocab.mjs`로 재생성됩니다.

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
