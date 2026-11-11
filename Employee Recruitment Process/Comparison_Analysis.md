# Employee Recruitment Process — Comparison Analysis

## Overview

This document analyzes the **Employee Recruitment Process** case study, applying the unified BPMN methodology from `Report-BPM.pdf` to compare **4 separate rigid process variants** against a **single unified flexible model** (`Flexible_Employee_Recruitment_Process.bpmn`). Using **flexibility by selection** via labelled XOR gateways and an optional bypass flow, all four variants remain executable while eliminating duplicated activities.

> **BPMN Models in this folder:**
> - `Rigid_Employee_Recruitment_V1_Standard.bpmn` — Variant V1 (Standard Corporate Hire)
> - `Rigid_Employee_Recruitment_V2_Remote_FastTrack.bpmn` — Variant V2 (Remote Fast-Track Hire)
> - `Rigid_Employee_Recruitment_V3_Legacy_Paper.bpmn` — Variant V3 (Legacy Paper-Dossier Hire)
> - `Rigid_Employee_Recruitment_V4_Rejected.bpmn` — Variant V4 (Rejected Candidate)
> - `Flexible_Employee_Recruitment_Process.bpmn` — Unified flexible model covering V1–V4

---

## 1. Variant Definitions

The employee recruitment process spans six stages: **application intake**, **screening**, **credential verification**, **assessment**, **hiring decision**, and **orientation**.

| Variant | Name | Activity Sequence | # Tasks |
|---------|------|-------------------|---------|
| **V1** | Standard Corporate Hire | Receive Application → Screen Resume → Verify Credentials → Conduct Panel Interview → Extend Job Offer → Conduct Orientation | 6 |
| **V2** | Remote Fast-Track Hire | Receive Application → Screen Resume → Verify Credentials → Run Automated Assessment → Extend Job Offer | 5 |
| **V3** | Legacy Paper-Dossier Hire | Receive Application → Review Paper Dossier → Verify Credentials → Conduct Panel Interview → Extend Job Offer → Conduct Orientation | 6 |
| **V4** | Rejected Candidate | Receive Application → Screen Resume → Verify Credentials → Conduct Panel Interview → Reject Candidate | 5 |

**Total activity occurrences across 4 rigid models:** `22` (`6 + 5 + 6 + 5`)

---

## 2. Activity Classification

### Shared (Mandatory) Activities (2)
Present in every variant:
| Activity | Variants |
|----------|----------|
| Receive Application | V1, V2, V3, V4 |
| Verify Credentials | V1, V2, V3, V4 |

### Alternative Activities (3 pairs = 6 activities)
Mutually exclusive tasks fulfilling the same stage in different ways:
| Variation Point | Default Branch | Guarded Branch (FEEL Condition) |
|-----------------|----------------|---------------------------------|
| **Screening Source** | Screen Resume *(V1, V2, V4)* | Review Paper Dossier *(`= variant = "V3"`)* |
| **Assessment Mode** | Conduct Panel Interview *(V1, V3, V4)* | Run Automated Assessment *(`= variant = "V2"`)* |
| **Hiring Decision** | Extend Job Offer *(V1, V2, V3)* | Reject Candidate *(`= variant = "V4"`)* |

### Optional Activity (1)
Present in some variants and skipped via a direct bypass flow in others:
| Variation Point | Default Branch | Guarded Branch (FEEL Condition) |
|-----------------|----------------|---------------------------------|
| **Orientation?** | Skip (bypass) *(V2, V4)* | Conduct Orientation *(`= variant = "V1" or variant = "V3"`)* |

**Total unique activities in the unified model:** `2 + 6 + 1 = 9`

---

## 3. Trace Verification

Tracing each `variant` value through `Flexible_Employee_Recruitment_Process.bpmn` reproduces the exact activity sequence of its corresponding rigid variant:

| Variant | Screening | Assessment | Decision | Orientation | Tasks | Match |
|---------|-----------|------------|----------|-------------|-------|-------|
| **V1** | Screen Resume | Conduct Panel Interview | Extend Job Offer | Conduct Orientation | 6 | ✓ |
| **V2** | Screen Resume | Run Automated Assessment | Extend Job Offer | Bypass | 5 | ✓ |
| **V3** | Review Paper Dossier | Conduct Panel Interview | Extend Job Offer | Conduct Orientation | 6 | ✓ |
| **V4** | Screen Resume | Conduct Panel Interview | Reject Candidate | Bypass | 5 | ✓ |

---

## 4. Structural Comparison (Table IV Format)

| Metric | 4 Rigid | 1 Unified | Change |
|--------|---------|-----------|--------|
| Process diagrams | 4 | 1 | −75% |
| Activity nodes | 22 (6+5+6+5) | 9 | −59% |
| Start and end events | 8 | 2 | −75% |
| XOR gateways | 0 | 8 | +8 |
| Total nodes | 30 | 19 | −37% |
| Sequence flows | 26 | 22 | −15% |

### Breakdown of Counts
- **4 rigid models combined:**
  - Events: `2 × 4 = 8` (1 start + 1 end per diagram)
  - Activities: `6 + 5 + 6 + 5 = 22`
  - Total nodes: `22 + 8 = 30`
  - Sequence flows: `7 + 6 + 7 + 6 = 26` (`tasks + 1` per rigid diagram)
- **1 unified flexible model (`Flexible_Employee_Recruitment_Process.bpmn`):**
  - Events: `2` (1 start + 1 end)
  - Activities: `9` (`Receive Application`, `Screen Resume`, `Review Paper Dossier`, `Verify Credentials`, `Conduct Panel Interview`, `Run Automated Assessment`, `Extend Job Offer`, `Reject Candidate`, `Conduct Orientation`)
  - XOR gateways: `8` (4 split/join pairs)
  - Total nodes: `2 + 9 + 8 = 19`
  - Sequence flows: `22`

---

## 5. Summary of Findings

- **Activity duplication cut by 59%:** Eliminates 13 of 22 duplicated activity nodes while keeping shared tasks (`Receive Application`, `Verify Credentials`) in a single place.
- **Total node reduction of 37%:** Total BPMN nodes drop from `30` to `19` (`-11` nodes) even after adding `8` XOR gateways.
- **Sequence flow reduction of 15%:** Sequence flows drop from `26` to `22`.
- **Behavioral equivalence:** All 4 recruitment variants remain executable and reproduce their rigid baselines identically.

