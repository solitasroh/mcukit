---
name: freertos
classification: capability
deprecation-risk: low
domain: mcu
platforms: [stm32, nxp-k]
description: |
  FreeRTOS 태스크/동기화 설계. xTaskCreate, Queue, Semaphore, Mutex, 스택 사이징.
  Triggers: FreeRTOS, RTOS, task, queue, semaphore, mutex, 태스크, タスク, 任务
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

# FreeRTOS Design Guide

## Task Creation
```c
// Static allocation (recommended for safety-critical)
StaticTask_t xTaskBuffer;
StackType_t xStack[256]; // 256 words = 1024 bytes on 32-bit
TaskHandle_t xHandle = xTaskCreateStatic(vMyTask, "MyTask",
  256, NULL, tskIDLE_PRIORITY + 2, xStack, &xTaskBuffer);

// Dynamic allocation
xTaskCreate(vMyTask, "MyTask", 256, NULL, 2, &xHandle);
```

## Stack Sizing Formula
```
Required Stack = Worst-case call depth (bytes)
               + Local variables (largest function)
               + ISR nesting overhead (if applicable)
               + FreeRTOS context save (64-100 bytes on Cortex-M)
               + Safety margin (20%)

Typical sizes:
  Simple task (GPIO toggle):  128 words (512 bytes)
  UART handler:               256 words (1024 bytes)
  Sensor processing:          512 words (2048 bytes)
  Network stack (LwIP):       1024+ words (4096+ bytes)
```

## Synchronization Primitives

### Queue (Data passing)
```c
QueueHandle_t xQueue = xQueueCreate(10, sizeof(SensorData_t));
xQueueSend(xQueue, &data, pdMS_TO_TICKS(100));      // Producer
xQueueReceive(xQueue, &data, portMAX_DELAY);         // Consumer
```

### Binary Semaphore (ISR → Task signaling)
```c
SemaphoreHandle_t xSem = xSemaphoreCreateBinary();
// In ISR:
BaseType_t xHigherPriorityTaskWoken = pdFALSE;
xSemaphoreGiveFromISR(xSem, &xHigherPriorityTaskWoken);
portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
// In Task:
xSemaphoreTake(xSem, portMAX_DELAY);
```

### Mutex (Resource protection)
```c
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();
if (xSemaphoreTake(xMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
  // Access shared resource
  xSemaphoreGive(xMutex);
}
```

## Priority Design Rules
- Highest: Safety-critical ISR handlers
- High: Time-sensitive control loops
- Medium: Communication processing
- Low: Logging, diagnostics
- Idle: LED heartbeat, watchdog feed

## STM32 CubeMX Integration
- CMSIS-RTOS v2 is the default wrapper (cmsis_os2.h)
- FreeRTOS path: `Middlewares/Third_Party/FreeRTOS/`
- Config: `FreeRTOSConfig.h` (configTOTAL_HEAP_SIZE, configMINIMAL_STACK_SIZE)
