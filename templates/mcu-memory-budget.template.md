# {feature} Memory Budget

## Target MCU

| Item | Value |
|------|-------|
| MCU | {chip_name} |
| Flash Total | {flash_total} KB |
| RAM Total | {ram_total} KB |
| Warning Threshold | Flash {flash_warn}% / RAM {ram_warn}% |

## Flash Budget

| Component | Size (KB) | Percent | Notes |
|-----------|:---------:|:-------:|-------|
| Bootloader | {size} | {pct}% | {notes} |
| Application Code (.text) | {size} | {pct}% | |
| Read-only Data (.rodata) | {size} | {pct}% | Strings, const tables |
| Init Values (.data) | {size} | {pct}% | Global variable init |
| OTA Reserve | {size} | {pct}% | Second bank / staging |
| Config/NVM | {size} | {pct}% | User settings |
| Reserve | {size} | {pct}% | Growth margin |
| **Total** | **{total}** | **{pct}%** | |

## RAM Budget

| Component | Size (KB) | Percent | Notes |
|-----------|:---------:|:-------:|-------|
| Main Stack | {size} | {pct}% | _Min_Stack_Size in .ld |
| Heap | {size} | {pct}% | _Min_Heap_Size (if used) |
| RTOS Tasks | {size} | {pct}% | {n} tasks x avg {avg} words |
| Global/Static (.data+.bss) | {size} | {pct}% | |
| DMA Buffers | {size} | {pct}% | UART/SPI/ADC |
| Comm Buffers | {size} | {pct}% | Ring buffers, protocol |
| Reserve | {size} | {pct}% | Growth margin |
| **Total** | **{total}** | **{pct}%** | |
