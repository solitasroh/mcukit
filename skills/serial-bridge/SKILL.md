---
name: serial-bridge
classification: capability
deprecation-risk: none
domain: wpf
platforms: [wpf, stm32, nxp-k]
description: |
  MCU↔WPF 시리얼 통신 브릿지 가이드. UART/SerialPort 설정 일관성, 프로토콜 설계.
  Triggers: serial, UART, SerialPort, 시리얼, 통신 브릿지, MCU WPF 연동
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep]
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

# MCU↔WPF Serial Bridge Guide

## MCU Side (STM32 HAL)
```c
huart1.Init.BaudRate = 115200;
huart1.Init.WordLength = UART_WORDLENGTH_8B;
huart1.Init.StopBits = UART_STOPBITS_1;
huart1.Init.Parity = UART_PARITY_NONE;
huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
```

## WPF Side (System.IO.Ports)
```csharp
// NuGet: System.IO.Ports (required in .NET 8, built-in in .NET Framework)
var port = new SerialPort("COM3", 115200, Parity.None, 8, StopBits.One);
port.DataReceived += (s, e) => {
    var data = port.ReadExisting();
    Dispatcher.Invoke(() => ReceivedText += data);
};
port.Open();
```

## Parameter Matching Checklist
| Parameter | MCU Value | WPF Value | Must Match |
|-----------|----------|-----------|:----------:|
| Baud Rate | 115200 | 115200 | Yes |
| Data Bits | WORDLENGTH_8B | 8 | Yes |
| Parity | PARITY_NONE | Parity.None | Yes |
| Stop Bits | STOPBITS_1 | StopBits.One | Yes |
| Flow Control | HWCONTROL_NONE | Handshake.None | Yes |

## Protocol Design Tips
- Define frame structure: [START][LENGTH][DATA...][CRC][END]
- Use CRC-8 or CRC-16 for error detection
- Implement timeout on both sides
- MCU: Use DMA circular receive for continuous data
- WPF: Use DataReceived event, marshal to UI thread with Dispatcher.Invoke
