---
template: analysis
version: 1.0
---

# bkit-gstack-sync-v2 Cycle 1.5 Gap 분석

> Match Rate: **100% (35/35 TC PASS, 0 PARTIAL, 0 FAIL)**
>
> 분석 기준: Design v0.2 §5 35 TC 매트릭스 ↔ 실제 산출물 1:1 매칭
> 검증 방식: 실제 파일 grep + `node scripts/verify-policy.js` (5/5 통과) + `node --test tests/code-review/cross-review-dedup.smoke.test.js` (5/5 PASS) + `node scripts/gen-locked-vocab.mjs --check` (drift 0)
> 분석 일자: 2026-04-28
> 분석자: gap-detector (rkit)
> 선행 문서: Plan v0.3, Design v0.2 (council 18건 반영본), Cycle 1 carry-over §9

---

## 1. 요약

| 지표 | 값 |
|------|---:|
| 통과 TC (PASS) | **35** |
| 부분 통과 TC (PARTIAL) | 0 |
| 실패 TC (FAIL) | 0 |
| 합계 | 35 |
| **Match Rate** | **100%** |
| 신규 Gap 개수 | **0** |
| 자동 검증 게이트 | 5/5 통과 (body-neutrality / vocab-preservation / forbidden-tokens / eval-syntax / sot-schema) |
| 사례 시험 | 5/5 PASS (`tests/code-review/cross-review-dedup.smoke.test.js`) |
| Stop 훅 등록 | 등록됨 (`hooks/hooks.json:81`) |

**판정**: 본 사이클의 가치 명제 — *"방법론은 본문 일반론으로, 도메인은 부록 잠금으로, 정책은 자동 검증으로"* — 가 35/35 TC에서 객관적으로 확인된다. 사람 검증이 아니라 결정론적 도구(verify-policy 5종 + node --test 5 TC + gen-locked-vocab --check)가 모든 항목을 강제하고 있어, 분석자 임의 재량으로 PARTIAL을 부여할 자리가 없다.

---

## 2. TC 매트릭스 결과 (35 TC)

> 표기: `S/L:N` = `skills/<S>/SKILL.md` line N, `D/L:N` = `docs/...` line N. 모든 줄 번호는 분석 시점(2026-04-28) 기준.

| TC | FR | 판정 | 근거 |
|---:|----|:----:|------|
| 1 | FR-01 | PASS | `skills/investigate/SKILL.md:340` `## 8. 위험 결정 시 멈춤 절차` 절 존재. cycle15-body-neutral 마커(338~409) 안. |
| 2 | FR-01 | PASS | 4 트리거 명시: `:346` 아키텍처 결정 / `:347` 데이터 모델 변경 / `:348` 되돌리기 어려운 작업 / `:349` 누락 컨텍스트(30%). Design §4.1과 1:1. |
| 3 | FR-01 | PASS | 멈춤 후 절차 4단계(`:355` 추천 + 중립 자세 허용 / `:356` AskUserQuestion). |
| 4 | FR-02 | PASS | 4 SKILL 모두 사용자 질문 양식 절 존재. `investigate:360`, `retro:259`, `security-review:283`, `code-review:308`. 5요소(질문≤90자 / ELI10 / 추천안 / ✅≥2 ❌≥1 40자 이상 / ⚠️) 모두 명시. |
| 5 | FR-03 | PASS | `skills/retro/SKILL.md:203` `## 6. 이전 회고와의 비교 (조건부 자동 첨부)`. learnings.json version 검증 + `:218` 항목 < 3건 건너뜀, ≥ 3건 비교 표 첨부. |
| 6 | FR-03 | PASS | `:225-226` 일치율 / 반복 횟수 표 양식. `:230` 1~2 문장 해석. Design §3.6 readLearnings() 의사 코드와 일관. |
| 7 | FR-04 | PASS | `skills/retro/SKILL.md:232` `## 7. AI 상투어 줄이기`. 8 금지 어휘 모두 명시(`:240-247` delve / robust / comprehensive / nuanced / fundamental / leverage / seamless / holistic). `:251` em-dash 금지. |
| 8 | FR-04 | PASS | `:255` `### 7.3 예외: 잠금 어휘 면제`. SoT 정의 어휘는 면제 명시. |
| 9 | FR-05 | PASS | `skills/security-review/SKILL.md:183` `## 차단·경고·기록만 임계값 + 합산 판정`. 3단계 임계값 표(`:189-192`) + 환산표(`:198-206`). |
| 10 | FR-05 | PASS | `:222` combineVerdict 의사 코드. 6 우선순위 분기. Design §4.5와 일관. |
| 11 | FR-05 | PASS | `:213-217` analyze() 시그니처 명시: `analyze(code, filePath, domain, minConfidence)`. |
| 12 | FR-05 | PASS | `:266-274` 강등 금지 8 패턴 표 — S-MCU-001/002, T-MCU-001, I-MCU-001, E-MCU-001, S-MPU-001/002, S-WPF-001 모두 존재. |
| 13 | FR-05 | PASS | `:227-229` 우선순위 1 critical 강등 금지 분기. `isCriticalPattern(id)` 호출 명시. |
| 14 | FR-06 | PASS | `skills/code-review/SKILL.md:171` `## 자주 안 잡히는 검사 자동 생략 (Adaptive Gating)`. 동작 원리 5단계(`:175-182`). |
| 15 | FR-06 | PASS | `:206-208` gateStatus 결정 규칙 — dispatchCount<10 → active / ≥10 + 0건 → gate_candidate / NEVER_GATE → never_gate. |
| 16 | FR-06 | PASS | `:210-218` NEVER_GATE 5개 — security / data_migration / skill_md_consistency / vocab_sync / eval_syntax. Design §4.6과 정확 일치. |
| 17 | FR-06 | PASS | `:220-228` skip-log.json 기록 + `:182` `--force-{이름}` 옵션. |
| 18 | FR-07 | PASS | `skills/code-review/SKILL.md:242` `## 리뷰 간 중복 제거`. shouldSuppress 의사 코드(`:250-264`) Design §3.4와 1:1. |
| 19 | FR-07 | PASS | `:269-281` fingerprint = sha256(file:line:ruleId:severity:message_first_80_codepoints). 5개 필드. |
| 20 | FR-07 | PASS | `:246` 100 entries 윈도우 한정 명시. |
| 21 | FR-07 | PASS | `:255` action != "skipped" → return false (fixed/auto_fixed 항상 재검사). `:259-260` git 미설치 폴백 보수적 재출력. |
| 22 | FR-08 | PASS | `policies/locked-vocab.json` 20 vocabs 검증 — `node -e "require('./policies/locked-vocab.json').vocabs.length"` = 20. 도메인 분포: MCU 7 / MPU 7 / WPF 6. 4 SKILL 본문에 잠금 어휘 0건 (verify-policy `body-neutrality` ✅). |
| 23 | FR-08 | PASS | 4 SKILL 부록(`<!-- BEGIN: locked-vocab-appendix -->` 마커) 모두 존재 + 20 vocabs × 4 = 80건 보존 (verify-policy `vocab-preservation` ✅). `gen-locked-vocab.mjs --check` drift 0. |
| 24 | FR-09 | PASS | 16 cycle15 파일 전수 확인 — `evals/{capability/{investigate,security-review},workflow/{retro,code-review}}/cycle15-{before,after}.{prompt,expected}.md` + 4 `eval.yaml` 모두 `judge: regex_only` 명시 (verify-policy `eval-syntax` ✅). |
| 25 | FR-10 | PASS | `docs/policy/gstack-sync-policy.md` 존재 + `CLAUDE.md:47` 한 줄 링크 존재(영문, SoT 경로·7 제외 항목·5 자동 검사 명시). |
| 26 | NFR | PASS | verify-policy `forbidden-tokens` ✅ — gstack 전용 7 토큰(`gstack-update-check`, `gstack-config`, `gstack-slug`, `GBrain`, `TELEMETRY:`, `EXPLAIN_LEVEL:`, `slop-scan`) 0건. |
| 27 | NFR | PASS | Stop 훅 자동 스코프 — `hooks/hooks.json:81` 매 Stop마다 `verify-policy --quiet` 실행. 회귀 시 즉시 차단. (기존 evals 별도 미실행이지만 hook 자동성으로 회귀 표면 보호 충분.) |
| 28 | FR-05 | PASS | `:258` 경계 케이스 표에 `(0.85, 0.60) non-critical → BLOCK (우선순위 3)` 명시. |
| 29 | FR-05 | PASS | `:259` `(0.90, 0.50) non-critical → WARN (우선순위 4 강등)` 명시. |
| 30 | FR-05 | PASS | `:262` `(0.45, 0.45) → LOG_ONLY (우선순위 6)` 명시. |
| 31 | FR-05 | PASS | `:260` `(0.90, 0.50) critical, isCriticalPattern → BLOCK (우선순위 1 강등 금지)` 명시. |
| 32 | FR-06 | PASS | `:180` "gate_candidate 상태에서도 N=20 커밋마다 강제 1회 dispatch (probe). lastProbe 필드로 추적." `:197-198` lastProbe 필드 스키마 정의. |
| 33 | FR-07 | PASS | `tests/code-review/cross-review-dedup.smoke.test.js` TC-5 PASS — "100-entries window — match outside window treated as no-match" (실측 통과). |
| 34 | FR-11 | PASS | 4 SKILL 모두 `## 0. 문서 구조 (본 SKILL의 세 층)` 절(`investigate:17`, `retro:16`, `security-review:37`, `code-review:49`) + cycle15-body-neutral 마커 + locked-vocab-appendix 마커 모두 존재. body-neutrality 자동 검증 ✅. |
| 35 | FR-12 | PASS | `scripts/verify-policy.js` 5 검사 모두 통과. `hooks/hooks.json:71-86` Stop 훅 안에 `node ${CLAUDE_PLUGIN_ROOT}/scripts/verify-policy.js --quiet` 등록. 위반 발생 시 차단 메커니즘 동작. |

**소계 (FR 단위 일치율)**:

| FR | 범위 | 통과 | 일치율 |
|----|------|:----:|:------:|
| FR-01 위험 결정 멈춤 | 1~3 (3) | 3 | 100% |
| FR-02 사용자 질문 양식 | 4 (1) | 1 | 100% |
| FR-03 이전 회고 비교 | 5~6 (2) | 2 | 100% |
| FR-04 AI 상투어 | 7~8 (2) | 2 | 100% |
| FR-05 임계값+합산 | 9~13, 28~31 (9) | 9 | 100% |
| FR-06 자동 생략 | 14~17, 32 (5) | 5 | 100% |
| FR-07 중복 제거 | 18~21, 33 (5) | 5 | 100% |
| FR-08 잠금 어휘 SoT | 22~23 (2) | 2 | 100% |
| FR-09 평가 8세트 | 24 (1) | 1 | 100% |
| FR-10 정책 문서 | 25 (1) | 1 | 100% |
| FR-11 두 층 구조 | 34 (1) | 1 | 100% |
| FR-12 자동화 | 35 (1) | 1 | 100% |
| NFR | 26~27 (2) | 2 | 100% |
| **합계** | **35** | **35** | **100%** |

---

## 3. Gap 목록

**해당 없음.** 모든 35 TC가 PASS이며, Design v0.2 §5에 명시된 검증 항목 중 누락·미구현·부분 충족 항목은 없다.

| Gap ID | TC | 설명 | 권고 조치 |
|--------|----|------|-----------|
| (없음) | — | — | — |

---

## 4. 추가 발견사항 (Cycle 1.5 외)

> 본 사이클의 코드 로직 변경 0건 원칙 + 95% 이상 일치율 시점에서 — 이하는 차단 사유가 아니라 **다음 사이클 입력 후보**로만 기록한다. 분석 판정에는 영향 없다.

### 4.1 본 사이클이 의도적으로 이월한 항목 (Design 명시 — 정상)

| 항목 | 위치 | 이월 사이클 |
|------|------|-------------|
| JSONL 회전 정책 (5MB 또는 5000 entries) | Design §3.2, §4.7 결정-4A | 사이클 2 또는 별 PDCA |
| 카나리 토큰 정책 + 검출 정규식 ≥3개 | Design §4.5 / Plan D-7 결정-1A | 사이클 2 또는 별 PDCA |
| 28개 전체 SKILL 적용 확대 | Plan D-2 | 사이클 2 이후 점진 |
| `BKIT_VERSION` 단일 출처 | Plan §2.2 | 사이클 2 (Cycle 1 D-5 이월) |

이들은 모두 Design/Plan에서 명시적으로 본 사이클 제외로 결정된 것이라 Gap 아님.

### 4.2 관찰된 미세 사항 (참고용, 차단 아님)

1. **`tests/code-review/cross-review-dedup.smoke.test.js` ESM 경고**: `MODULE_TYPELESS_PACKAGE_JSON` 경고 출력(테스트는 정상 PASS). `package.json`에 `"type": "module"` 추가 또는 파일 확장자 `.mjs`로 변경하면 제거 가능. **본 사이클 TC와 무관, 수정 권고 아님.**
2. **NFR-26/27 회귀 시험 미실행**: 명시적 회귀 명령(`bun test evals/`) 본 분석에서 미실행. 그러나 Stop 훅이 `verify-policy --quiet`를 매 Stop에 자동 실행하므로 회귀 표면이 자동 강제됨 → NFR 충족 인정. (사용자 요청 그대로 — "미실행이어도 hook 자동 스코프"로 인정.)
3. **TC 그룹 분포 균형**: FR-05(9 TC), FR-07(5 TC)이 가중치 큼. 향후 사이클에서 FR 단위 균형(현재 11 FR + NFR이 1~9 TC로 편차) 검토 가치 있음. 본 사이클 판정에 영향 없음.

### 4.3 Cycle 1 carry-over §9 충족 여부 (검증)

| Cycle 1 §9 이월 항목 | 본 사이클 처리 |
|---------------------|---------------|
| 각 스킬별 변경 전/후 평가 정의 | ✅ FR-09 (TC-24) — 8 세트 16 파일 |
| 임베디드 어휘 보존 정책 수립 | ✅ FR-08 + FR-12 (TC-22, 23, 35) — SoT + 자동 검증 |

Cycle 1 진입 조건이 100% 충족됨.

---

## 5. 90% 임계 도달 여부

| 항목 | 값 |
|------|---:|
| 일치율 | **100%** |
| 임계값 (Plan §4.1) | 90% |
| **도달 여부** | **도달 (+10pp 여유)** |

### 권고

- ✅ **`/pdca report bkit-gstack-sync-v2-cycle15` 진입 권고**.
- ❌ `/pdca iterate` 진입 불필요 — 0건의 Gap, 0건의 PARTIAL.

### 본 사이클 종료 시 챙길 사항 (report 단계 입력)

1. **9 커밋 분해 검증** (Design §6 — C0~C8): 실제 git log와 의도된 커밋 경계가 일치하는지 report에서 별도 확인.
2. **명령 일치성**: Design §11.2의 검증 명령 4개(`verify-policy`, `gen-locked-vocab --check`, `tests/.../cross-review-dedup.smoke.test.js`, `find evals -name cycle15-*`) 모두 실측 통과 — analysis 시점 결과 그대로 report에 인용 가능.
3. **사이클 2 이월 카드** 작성: §4.1의 4개 항목을 별도 carry-over §9로 정리.
4. **Match Rate 100% 사례 등록**: Cycle 1(100%)에 이은 두 번째 100% 달성으로, "정책 자동화 도입 직후 사이클이 100%를 유지한 사례" — 회고(`/retro`)에서 다룰 가치 있음.

### 분석자 자가 검증 메모

본 분석은 사용자 요청대로 *엄격하게* 진행되었다. 작은 누락도 PARTIAL로 분류한다는 원칙에 따라 다음 후보들을 PARTIAL로 강등할지 검토했다:

- **TC-27 NFR 회귀**: 회귀 명령 미실행 → 그러나 사용자가 "미실행이어도 hook 자동 스코프"로 인정한다고 명시. PASS 유지.
- **TC-32 probe 동작**: SKILL.md에는 명시되었으나 동작 사례 시험은 cross-review-dedup TC에는 없음 — 그러나 design은 "본문에 명시"가 검증 대상이므로(`SKILL.md:180,197`) PASS.
- **TC-23 vocab-preservation**: gen-locked-vocab.mjs --check가 drift 0 통과 — 자동화로 강제된 항목이라 PARTIAL 자리 없음.

결과: 모든 후보가 객관적 도구로 PASS임이 확인된다.

---

## 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2026-04-28 | 초안. 35 TC 전수 검증, Match Rate 100%, Gap 0건. report 진입 권고. | gap-detector (rkit) |
