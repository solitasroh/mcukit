# {feature} HW Specification

## 1. MCU Selection

| Item | Value |
|------|-------|
| MCU | {chip_name} |
| Core | Cortex-M{x} @ {freq} MHz |
| Flash | {flash_size} KB |
| RAM | {ram_size} KB |
| Package | {package} |
| Operating Voltage | {voltage} V |
| Temperature Range | {temp_min} ~ {temp_max} C |

## 2. Pin Assignment Table

| Pin | Signal | Mode | AF | Label | Notes |
|-----|--------|------|:--:|-------|-------|
| {pin} | {signal} | {mode} | {af} | {label} | {notes} |

## 3. Clock Configuration

| Clock | Frequency | Source | Divider |
|-------|-----------|--------|---------|
| HSE | {hse_freq} MHz | Crystal | - |
| SYSCLK | {sysclk} MHz | PLL | PLLM={m}, PLLN={n}, PLLP={p} |
| AHB (HCLK) | {ahb} MHz | SYSCLK | /{ahb_div} |
| APB1 | {apb1} MHz | AHB | /{apb1_div} (max 42 MHz) |
| APB2 | {apb2} MHz | AHB | /{apb2_div} (max 84 MHz) |

## 4. Peripheral Allocation

| Peripheral | Instance | Purpose | Pins | DMA | IRQ Priority |
|-----------|----------|---------|------|:---:|:------------:|
| UART | {instance} | {purpose} | TX:{pin}, RX:{pin} | {ch} | {pri} |
| SPI | {instance} | {purpose} | SCK/MOSI/MISO/CS | {ch} | {pri} |
| I2C | {instance} | {purpose} | SCL:{pin}, SDA:{pin} | {ch} | {pri} |
| TIM | {instance} | {purpose} | {pins} | - | {pri} |
| ADC | {instance} | {purpose} | {pins} | {ch} | {pri} |

## 5. External Components

| Component | Interface | I/O Pins | Notes |
|-----------|-----------|----------|-------|
| {component} | {interface} | {pins} | {notes} |

## 6. Power Budget

| Mode | Current (mA) | Duration | Notes |
|------|:------------:|----------|-------|
| Run | {run_ma} | Continuous | All peripherals active |
| Sleep | {sleep_ma} | {duration} | {active_peripherals} |
| Stop | {stop_ua} uA | {duration} | RTC only |
