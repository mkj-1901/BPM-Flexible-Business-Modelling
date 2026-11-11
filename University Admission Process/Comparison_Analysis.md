# University Admission Process — Comparison Analysis

## Overview

This document analyzes the **University Admission Process** case study, extending the unified BPMN methodology from `Report-BPM.pdf` (Section VII future work) to a second domain. It compares **4 separate rigid process variants** against a **single unified flexible model** (`Flexible_University_Admission_Process.bpmn`) constructed with XOR gateways and bypass flows (**flexibility by selection**).

> **BPMN Models in this folder:**
> - `Rigid_University_Admission_V1_Standard.bpmn` — Variant V1 (Standard Admission)
> - `Rigid_University_Admission_V2_Online_FastTrack.bpmn` — Variant V2 (Online Fast-Track)
> - `Rigid_University_Admission_V3_Legacy_Paper.bpmn` — Variant V3 (Legacy Paper-Based)
> - `Rigid_University_Admission_V4_Rejected.bpmn` — Variant V4 (Rejected Application)
> - `Flexible_University_Admission_Process.bpmn` — Unified flexible model covering V1–V4

---

## 1. Variant Definitions

The university admission process spans six stages: **application submission**, **eligibility check**, **assessment (exam/interview)**, **merit evaluation**, **admission decision**, and **enrollment**.

| Variant | Name | Activity Sequence | # Tasks |
|---------|------|-------------------|---------|
| **V1** | Standard Admission | Submit Application → Check Eligibility (Manual) → Conduct Entrance Exam → Evaluate Merit (Committee) → Offer Admission → Enroll Student | 6 |
| **V2** | Online Fast-Track | Submit Application → Check Eligibility (Automated) → Evaluate Merit (Automated) → Offer Admission | 4 |
| **V3** | Legacy Paper-Based | Submit Application → Check Eligibility (Manual) → Conduct Interview → Evaluate Merit (Committee) → Offer Admission → Enroll Student | 6 |
| **V4** | Rejected Application | Submit Application → Check Eligibility (Manual) → Conduct Entrance Exam → Evaluate Merit (Committee) → Reject Application | 5 |

**Total activity occurrences across 4 rigid models:** `21` (`6 + 4 + 6 + 5`)

---

## 2. Activity Classification

### Shared (Mandatory) Activity (1)
Present in every variant:
| Activity | Variants |
|----------|----------|
| Submit Application | V1, V2, V3, V4 |

### Alternative & Hybrid Variation Points (8 activities across 4 variation points)
| Variation Point | Pattern Type | Branches & FEEL Conditions |
|-----------------|--------------|----------------------------|
| **Eligibility Check** | Alternative | Default: `Check Eligibility (Manual)` *(V1, V3, V4)* \| Guarded: `Check Eligibility (Automated)` *(`= variant = "V2"`)* |
| **Assessment Mode** | Alternative + Optional (3-way) | Default: `Conduct Entrance Exam` *(V1, V4)* \| Guarded: `Conduct Interview` *(`= variant = "V3"`)* \| Guarded bypass: `Skip` *(`= variant = "V2"`)* |
| **Merit Evaluation** | Alternative | Default: `Evaluate Merit (Committee)` *(V1, V3, V4)* \| Guarded: `Evaluate Merit (Automated)` *(`= variant = "V2"`)* |
| **Admission Decision** | Alternative | Default: `Offer Admission` *(V1, V2, V3)* \| Guarded: `Reject Application` *(`= variant = "V4"`)* |

### Optional Activity (1)
| Variation Point | Pattern Type | Branches & FEEL Conditions |
|-----------------|--------------|----------------------------|
| **Enrollment?** | Optional | Default: `Skip (bypass)` *(V2, V4)* \| Guarded: `Enroll Student` *(`= variant = "V1" or variant = "V3"`)* |

**Total unique activities in the unified model:** `1 + 2 + 2 + 2 + 2 + 1 = 10`

---

## 3. Trace Verification

Tracing each `variant` value through `Flexible_University_Admission_Process.bpmn` reproduces the exact activity sequence of its corresponding rigid model:

| Variant | Eligibility | Assessment | Merit | Decision | Enrollment | Tasks | Match |
|---------|-------------|------------|-------|----------|------------|-------|-------|
| **V1** | Check Eligibility (Manual) | Conduct Entrance Exam | Evaluate Merit (Committee) | Offer Admission | Enroll Student | 6 | ✓ |
| **V2** | Check Eligibility (Automated) | Bypass | Evaluate Merit (Automated) | Offer Admission | Bypass | 4 | ✓ |
| **V3** | Check Eligibility (Manual) | Conduct Interview | Evaluate Merit (Committee) | Offer Admission | Enroll Student | 6 | ✓ |
| **V4** | Check Eligibility (Manual) | Conduct Entrance Exam | Evaluate Merit (Committee) | Reject Application | Bypass | 5 | ✓ |

---

## 4. Structural Comparison (Table IV Format)

| Metric | 4 Rigid | 1 Unified | Change |
|--------|---------|-----------|--------|
| Process diagrams | 4 | 1 | −75% |
| Activity nodes | 21 (6+4+6+5) | 10 | −52% |
| Start and end events | 8 | 2 | −75% |
| XOR gateways | 0 | 10 | +10 |
| Total nodes | 29 | 22 | −24% |
| Sequence flows | 25 | 27 | +8% |

### Breakdown of Counts
- **4 rigid models combined:**
  - Events: `2 × 4 = 8` (1 start + 1 end per diagram)
  - Activities: `6 + 4 + 6 + 5 = 21`
  - Total nodes: `21 + 8 = 29`
  - Sequence flows: `7 + 5 + 7 + 6 = 25` (`tasks + 1` per rigid diagram)
- **1 unified flexible model (`Flexible_University_Admission_Process.bpmn`):**
  - Events: `2` (1 start + 1 end)
  - Activities: `10` (`Submit Application`, `Check Eligibility (Manual)`, `Check Eligibility (Automated)`, `Conduct Entrance Exam`, `Conduct Interview`, `Evaluate Merit (Committee)`, `Evaluate Merit (Automated)`, `Offer Admission`, `Reject Application`, `Enroll Student`)
  - XOR gateways: `10` (5 split/join pairs)
  - Total nodes: `2 + 10 + 10 = 22`
  - Sequence flows: `27`

---

## 5. Summary of Findings

- **Activity nodes reduced by 52%:** Duplicated task occurrences fall from `21` across four separate diagrams to `10` unique activities in one diagram.
- **Total nodes reduced by 24%:** Even with `10` XOR gateways (`5` split/join pairs) to accommodate 5 variation points (including a 3-way assessment split with bypass), total nodes drop from `29` to `22`.
- **Sequence flow trade-off (+8%):** Because this domain introduces an extra variation point (5 split/join pairs vs. 4 in the loan case) and fewer shared mandatory tasks (`1` vs. `2`), sequence flows increase slightly from `25` to `27` (`+2` flows).
- **Behavioral equivalence:** All 4 process variants remain executable and match their rigid baselines identically.
