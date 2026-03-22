# NXP MCUXpresso SDK Patterns Reference

## Initialization Sequence
```c
BOARD_InitBootPins();       // pin_mux.c
BOARD_InitBootClocks();     // clock_config.c
BOARD_InitBootPeripherals();// peripherals.c (optional)
BOARD_InitDebugConsole();   // Debug UART
```

## Driver Pattern (fsl_* API)
```c
// 1. Get default config
uart_config_t config;
UART_GetDefaultConfig(&config);
config.baudRate_Bps = 115200;
config.enableTx = true;
config.enableRx = true;

// 2. Init with clock frequency
UART_Init(UART0, &config, CLOCK_GetFreq(kCLOCK_BusClk));

// 3. Use blocking or non-blocking API
UART_WriteBlocking(UART0, data, len);
UART_ReadBlocking(UART0, data, len);
```

## GPIO Pattern
```c
gpio_pin_config_t config = { kGPIO_DigitalOutput, 0 };
GPIO_PinInit(BOARD_LED_GPIO, BOARD_LED_PIN, &config);
GPIO_PortToggle(BOARD_LED_GPIO, 1U << BOARD_LED_PIN);
```

## Key Differences from STM32 HAL
- No handle pattern (pass peripheral base address directly)
- Clock source explicitly passed to init functions
- Pin mux configured separately in pin_mux.c
- `fsl_device_registers.h` instead of `stm32f4xx.h`
- Board-level abstraction in board.h (BOARD_* defines)
