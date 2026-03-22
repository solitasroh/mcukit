# STM32 HAL Code Patterns Reference

## Initialization Sequence
```c
HAL_Init();              // SysTick, Flash, NVIC group priority
SystemClock_Config();    // PLL, bus dividers (CubeMX generated)
MX_GPIO_Init();          // Pin modes (CubeMX generated)
MX_DMA_Init();           // DMA channels (MUST be before peripherals using DMA)
MX_USART1_UART_Init();  // Peripheral init
```

## HAL Handle Pattern
```c
UART_HandleTypeDef huart1;  // Global handle (CubeMX generated)
SPI_HandleTypeDef hspi1;
I2C_HandleTypeDef hi2c1;
TIM_HandleTypeDef htim1;
ADC_HandleTypeDef hadc1;
```

## DMA Best Practices
- DMA init MUST come before peripheral init in main()
- DMA buffers should be in non-cached RAM (Cortex-M7: use __attribute__((section(".noncacheable"))))
- Avoid DMA buffers on stack (use global or heap)
- Align DMA buffers to 4 bytes minimum

## Callback Pattern (Override weak functions)
```c
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart) { /* TX done */ }
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) { /* RX done */ }
void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)  { /* Error */ }
void HAL_SPI_TxRxCpltCallback(SPI_HandleTypeDef *hspi)  { /* SPI done */ }
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) { /* Timer */ }
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)   { /* ADC done */ }
```

## MSP (MCU Support Package) Pattern
```c
// stm32f4xx_hal_msp.c (CubeMX generated)
void HAL_UART_MspInit(UART_HandleTypeDef *huart) {
  // Enable clock: __HAL_RCC_USART1_CLK_ENABLE()
  // Configure GPIO pins
  // Configure DMA
  // Enable NVIC interrupt
}
void HAL_UART_MspDeInit(UART_HandleTypeDef *huart) {
  // Disable clock, reset GPIO, disable DMA/NVIC
}
```

## Error Checking Pattern
```c
if (HAL_UART_Transmit(&huart1, data, len, 100) != HAL_OK) {
  Error_Handler(); // or custom error handling
}
```

## HAL_StatusTypeDef Values
- HAL_OK (0x00): Operation completed successfully
- HAL_ERROR (0x01): Operation failed
- HAL_BUSY (0x02): Peripheral is busy
- HAL_TIMEOUT (0x03): Timeout occurred
