---
name: imx-bsp
classification: capability
deprecation-risk: low
domain: mpu
platforms: [imx6, imx6ull, imx28]
description: |
  i.MX BSP/Device Tree 개발 가이드. pinctrl, 클럭, GPIO 노드 작성, 보드 포팅.
  Triggers: i.MX, BSP, Device Tree, DTS, pinctrl, imx6, imx6ull, imx28
user-invocable: true
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
imports:
  - ${PLUGIN_ROOT}/refs/imx/dts-patterns.md
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

# i.MX BSP / Device Tree Guide

## DTS Structure
```
/ {
    model = "Freescale i.MX6 Quad SABRE SD Board";
    compatible = "fsl,imx6q-sabresd", "fsl,imx6q";
};
&iomuxc {
    pinctrl_uart1: uart1grp {
        fsl,pins = <
            MX6QDL_PAD_CSI0_DAT10__UART1_TX_DATA  0x1b0b1
            MX6QDL_PAD_CSI0_DAT11__UART1_RX_DATA  0x1b0b1
        >;
    };
};
&uart1 {
    pinctrl-names = "default";
    pinctrl-0 = <&pinctrl_uart1>;
    status = "okay";
};
```

## Platform Differences

| | i.MX6Q/DL | i.MX6ULL | i.MX28 |
|---|:-:|:-:|:-:|
| Pad macro prefix | MX6QDL_PAD_ | MX6UL_PAD_ | MX28_PAD_ |
| pinctrl compatible | fsl,imx6q-iomuxc | fsl,imx6ul-iomuxc | fsl,imx28-pinctrl |
| GPU node | &gpu | N/A (PXP only) | N/A |
| Ethernet | fec | fec1, fec2 | fec0 (mxs-fec) |

## Boot Sequence
- i.MX6/6ULL: Boot ROM → U-Boot (SPL) → Kernel → rootfs
- i.MX28: Boot ROM → mxs-bootlets / U-Boot SPL → Kernel → rootfs

## Validation
```bash
dtc -I dts -O dtb -o /dev/null -W no-unit_address_vs_reg board.dts
```
