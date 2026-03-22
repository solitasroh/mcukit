# {feature} Driver Specification

## 1. Overview

| Item | Value |
|------|-------|
| Driver Name | {driver_name} |
| Target Device | {device_name} |
| Interface | {interface} (SPI/I2C/UART/GPIO) |
| HAL Dependency | {hal_module} |

## 2. Hardware Connection

| MCU Pin | Device Pin | Signal | Notes |
|---------|-----------|--------|-------|
| {mcu_pin} | {dev_pin} | {signal} | {notes} |

## 3. Register Map (if applicable)

| Address | Name | R/W | Default | Description |
|:-------:|------|:---:|:-------:|-------------|
| 0x{addr} | {name} | {rw} | 0x{default} | {description} |

## 4. API Design

### Init
```c
{driver}_StatusTypeDef {driver}_Init({driver}_HandleTypeDef *h{driver});
```

### Read/Write
```c
{driver}_StatusTypeDef {driver}_Read(h{driver}, uint8_t *data, uint16_t len);
{driver}_StatusTypeDef {driver}_Write(h{driver}, const uint8_t *data, uint16_t len);
```

### Error Handling
```c
typedef enum {
  {DRIVER}_OK = 0,
  {DRIVER}_ERROR,
  {DRIVER}_TIMEOUT,
  {DRIVER}_BUSY,
} {driver}_StatusTypeDef;
```

## 5. Timing Requirements

| Parameter | Min | Typ | Max | Unit |
|-----------|:---:|:---:|:---:|:----:|
| Init time | - | {typ} | {max} | ms |
| Read latency | - | {typ} | {max} | us |
| Power-on delay | {min} | - | - | ms |

## 6. Test Plan

| # | Test Case | Expected Result |
|---|-----------|----------------|
| 1 | Init with valid config | Return OK |
| 2 | Read device ID register | Match datasheet value |
| 3 | Write and read-back | Data matches |
| 4 | Timeout on disconnected device | Return TIMEOUT |
