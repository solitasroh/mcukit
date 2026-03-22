---
name: cmake-embedded
classification: capability
deprecation-risk: low
domain: mcu
platforms: [stm32, nxp-k]
description: |
  임베디드 CMake 빌드 시스템 구성. arm-none-eabi 툴체인 파일, 링커 스크립트 연동.
  Triggers: CMake, embedded build, 빌드 시스템, ビルド, 构建系统
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
pdca-phase: do
---

# Embedded CMake Build Guide

## Toolchain File (arm-none-eabi.cmake)
```cmake
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER arm-none-eabi-gcc)
set(CMAKE_CXX_COMPILER arm-none-eabi-g++)
set(CMAKE_ASM_COMPILER arm-none-eabi-gcc)
set(CMAKE_OBJCOPY arm-none-eabi-objcopy)
set(CMAKE_SIZE arm-none-eabi-size)
set(CMAKE_C_FLAGS_INIT "-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard")
set(CMAKE_EXE_LINKER_FLAGS_INIT "-specs=nosys.specs -specs=nano.specs")
```

## CMakeLists.txt Structure
```cmake
cmake_minimum_required(VERSION 3.20)
set(CMAKE_TOOLCHAIN_FILE ${CMAKE_SOURCE_DIR}/cmake/arm-none-eabi.cmake)
project(firmware C ASM)

# Linker script
set(LINKER_SCRIPT ${CMAKE_SOURCE_DIR}/STM32F407VGTx_FLASH.ld)
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -T${LINKER_SCRIPT} -Wl,-Map=firmware.map")

# Sources
file(GLOB_RECURSE SOURCES "Core/Src/*.c" "Drivers/*.c")
add_executable(firmware.elf ${SOURCES} Core/Startup/startup_stm32f407xx.s)

# Post-build: generate .bin and print size
add_custom_command(TARGET firmware.elf POST_BUILD
  COMMAND ${CMAKE_OBJCOPY} -O binary firmware.elf firmware.bin
  COMMAND ${CMAKE_SIZE} firmware.elf)
```

## Build Commands
```bash
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
cmake --build . -j$(nproc)
```
