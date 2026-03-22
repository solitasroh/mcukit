---
name: communication
classification: capability
deprecation-risk: low
domain: mcu
platforms: [stm32, nxp-k]
description: |
  UART/SPI/I2C/CAN 통신 드라이버 패턴. DMA 전송, 인터럽트 수신, 프로토콜 설계.
  Triggers: UART, SPI, I2C, CAN, USB, DMA, 통신, 시리얼, 通信, comunicación
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep]
pdca-phase: do
---

# MCU Communication Peripheral Guide

## UART DMA (Recommended for continuous RX)
```c
// Circular DMA receive (never stops)
uint8_t rxBuf[256];
HAL_UARTEx_ReceiveToIdle_DMA(&huart1, rxBuf, sizeof(rxBuf));
__HAL_DMA_DISABLE_IT(huart1.hdmarx, DMA_IT_HT); // Disable half-transfer if not needed

void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size) {
  // Process rxBuf[0..Size-1], restart DMA
  HAL_UARTEx_ReceiveToIdle_DMA(huart, rxBuf, sizeof(rxBuf));
}
```

## SPI Full-Duplex
```c
uint8_t txData[4] = {0x80, 0x00, 0x00, 0x00}; // Read register 0x00
uint8_t rxData[4];
HAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_RESET); // CS low
HAL_SPI_TransmitReceive(&hspi1, txData, rxData, 4, 100);
HAL_GPIO_WritePin(CS_GPIO_Port, CS_Pin, GPIO_PIN_SET);   // CS high
```

## I2C Sensor Read (Register-based)
```c
uint8_t regAddr = 0x75; // WHO_AM_I register
uint8_t value;
HAL_I2C_Mem_Read(&hi2c1, (0x68 << 1), regAddr, I2C_MEMADD_SIZE_8BIT, &value, 1, 100);
```

## CAN Bus
```c
CAN_TxHeaderTypeDef txHeader = {
  .StdId = 0x321, .IDE = CAN_ID_STD,
  .RTR = CAN_RTR_DATA, .DLC = 8
};
uint32_t mailbox;
HAL_CAN_AddTxMessage(&hcan1, &txHeader, txData, &mailbox);
```

## Design Rules
- UART RX: Always use DMA or IT (polling loses data at high baud rates)
- SPI CS: Manual GPIO control recommended over hardware NSS
- I2C: Always check HAL_OK return, implement retry for NACK
- CAN: Configure filters before HAL_CAN_Start()
- DMA buffers: Place in non-cacheable memory region on Cortex-M7
