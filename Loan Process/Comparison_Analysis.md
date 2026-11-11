# Loan Application Process — Comparison Analysis

## Overview

This document analyzes the **Loan Application Process** case study from `Report-BPM.pdf`, comparing **4 separate rigid process variants** against a **single unified flexible BPMN model** (`Flexible_Loan_Application_Process.bpmn`). Using **flexibility by selection** via labelled XOR gateways and an optional bypass flow, all four variants remain executable while reducing node and diagram duplication.

> **BPMN Models in this folder:**
> - `Rigid_Loan_Application_Process.bpmn` — Variant V1 (Standard branch)
> - `Rigid_Loan_V2_Digital_FastTrack.bpmn` — Variant V2 (Digital fast-track)
> - `Rigid_Loan_V3_Legacy_Paper.bpmn` — Variant V3 (Legacy paper-file)
> - `Flexible_Loan_Application_Process.bpmn` — Unified flexible model covering V1–V4

---

## 1. Variant Definitions (Table I of Report)

The loan application process spans six stages: **intake**, **credit check**, **document verification**, **assessment**, **decision**, and **archiving**.

| Variant | Name | Activity Sequence | # Tasks |
|---------|------|-------------------|---------|
| **V1** | Standard branch | Receive Request → Check Credit System → Verify Documents → Assess Manually → Accept Loan → Archive Request | 6 |
| **V2** | Digital fast-track | Receive Request → Check Credit System → Verify Documents → Auto-Approve Check → Accept Loan | 5 |
| **V3** | Legacy paper-file | Receive Request → Check Paper Archive → Verify Documents → Assess Manually → Accept Loan → Archive Request | 6 |
| **V4** | High-risk rejected | Receive Request → Check Credit System → Verify Documents → Assess Manually → Reject Loan | 5 |

**Total activity occurrences across 4 rigid models:** `22` (`6 + 5 + 6 + 5`)

---

## 2. Activity Classification

### Shared (Mandatory) Activities (2)
Present in every variant:
| Activity | Variants |
|----------|----------|
| Receive Request | V1, V2, V3, V4 |
| Verify Documents | V1, V2, V3, V4 |

### Alternative Activities (3 pairs = 6 activities)
Mutually exclusive tasks fulfilling the same stage in different ways:
| Variation Point | Default Branch | Guarded Branch (FEEL Condition) |
|-----------------|----------------|---------------------------------|
| **Credit Source** | Check Credit System *(V1, V2, V4)* | Check Paper Archive *(`= variant = "V3"`)* |
| **Assessment Mode** | Assess Manually *(V1, V3, V4)* | Auto-Approve Check *(`= variant = "V2"`)* |
| **Loan Decision** | Accept Loan *(V1, V2, V3)* | Reject Loan *(`= variant = "V4"`)* |

### Optional Activity (1)
Present in some variants and skipped via a direct bypass flow in others:
| Variation Point | Default Branch | Guarded Branch (FEEL Condition) |
|-----------------|----------------|---------------------------------|
| **Archive?** | Skip (bypass) *(V2, V4)* | Archive Request *(`= variant = "V1" or variant = "V3"`)* |

**Total unique activities in the unified model:** `2 + 6 + 1 = 9`

---

## 3. Trace Verification (Table III of Report)

Tracing each `variant` value through `Flexible_Loan_Application_Process.bpmn` reproduces the exact activity sequence of its corresponding rigid variant:

| Variant | Credit | Assess | Decision | Archive | Tasks | Match |
|---------|--------|--------|----------|---------|-------|-------|
| **V1** | Check Credit System | Assess Manually | Accept Loan | Archive Request | 6 | ✓ |
| **V2** | Check Credit System | Auto-Approve Check | Accept Loan | Bypass | 5 | ✓ |
| **V3** | Check Paper Archive | Assess Manually | Accept Loan | Archive Request | 6 | ✓ |
| **V4** | Check Credit System | Assess Manually | Reject Loan | Bypass | 5 | ✓ |

---

## 4. Structural Comparison (Table IV of Report)

| Metric | 4 Rigid | 1 Unified | Change |
|--------|---------|-----------|--------|
| Process diagrams | 4 | 1 | −75% |
| Activity nodes | 22 (6+5+6+5) | 9 | −59% |
| Start and end events | 8 | 2 | −75% |
| XOR gateways | 0 | 8 | +8 |
| Total nodes | 30 | 19 | −37% |
| Sequence flows | 26 | 22 | −15% |

### Breakdown of Counts
- **Rigid baseline (4 variants):**
  - Events: `2 × 4 = 8` (1 start + 1 end per diagram)
  - Activities: `6 + 5 + 6 + 5 = 22`
  - Total nodes: `22 + 8 = 30`
  - Sequence flows: `7 + 6 + 7 + 6 = 26` (each rigid model has `tasks + 1` flows)
- **Unified flexible model (`Flexible_Loan_Application_Process.bpmn`):**
  - Events: `2` (1 start + 1 end)
  - Activities: `9` (`Receive Request`, `Check Credit System`, `Check Paper Archive`, `Verify Documents`, `Assess Manually`, `Auto-Approve Check`, `Accept Loan`, `Reject Loan`, `Archive Request`)
  - XOR gateways: `8` (4 split/join pairs)
  - Total nodes: `2 + 9 + 8 = 19`
  - Sequence flows: `22`

---

## 5. Summary of Findings

- **Activity duplication cut by 59%:** Eliminates 13 of 22 duplicated activity nodes while defining shared tasks (`Receive Request`, `Verify Documents`) in a single place.
- **Total node reduction of 37%:** Total BPMN nodes drop from `30` to `19` (`-11` nodes) even after adding `8` XOR gateways.
- **Sequence flow reduction of 15%:** Connections drop from `26` to `22`.
- **Trade-off:** Reduction in duplication is paid for by `8` XOR gateways (4 split/join pairs) and guard conditions on the `variant` variable.
