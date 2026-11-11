# BPM-Flexible-Business-Modelling

BPM Course Final Project (**Group 3**) exploring **flexible business process modeling** with optional and alternative activities in **BPMN 2.0**.

## Overview

Instead of maintaining separate rigid BPMN diagrams for every operational variant, this project applies **flexibility by selection** (using labelled XOR gateways, FEEL guard conditions, and bypass flows) to consolidate multiple process variants into a single unified BPMN model across three domains:

1. **Loan Application Process** (`Loan Process/`) — Merges 4 variants (*Standard branch*, *Digital fast-track*, *Legacy paper-file*, *High-risk rejected*) into 1 unified model (`22 → 9` activities, `30 → 19` total nodes, `26 → 22` sequence flows).
2. **University Admission Process** (`University Admission Process/`) — Merges 4 variants (*Standard Admission*, *Online Fast-Track*, *Legacy Paper-Based*, *Rejected Application*) into 1 unified model (`21 → 10` activities, `29 → 22` total nodes, `25 → 27` sequence flows).
3. **Employee Recruitment Process** (`Employee Recruitment Process/`) — Merges 4 variants (*Standard Corporate Hire*, *Remote Fast-Track Hire*, *Legacy Paper-Dossier Hire*, *Rejected Candidate*) into 1 unified model (`22 → 9` activities, `30 → 19` total nodes, `26 → 22` sequence flows).

## Repository Structure

```
BPM-Flexible-Business-Modelling/
├── README.md
├── Report-BPM.pdf
├── Loan Process/
│   ├── Rigid_Loan_Application_Process.bpmn
│   ├── Rigid_Loan_V2_Digital_FastTrack.bpmn
│   ├── Rigid_Loan_V3_Legacy_Paper.bpmn
│   ├── Flexible_Loan_Application_Process.bpmn
│   └── Comparison_Analysis.md
├── University Admission Process/
│   ├── Rigid_University_Admission_V1_Standard.bpmn
│   ├── Rigid_University_Admission_V2_Online_FastTrack.bpmn
│   ├── Rigid_University_Admission_V3_Legacy_Paper.bpmn
│   ├── Rigid_University_Admission_V4_Rejected.bpmn
│   ├── Flexible_University_Admission_Process.bpmn
│   └── Comparison_Analysis.md
└── Employee Recruitment Process/
    ├── Rigid_Employee_Recruitment_V1_Standard.bpmn
    ├── Rigid_Employee_Recruitment_V2_Remote_FastTrack.bpmn
    ├── Rigid_Employee_Recruitment_V3_Legacy_Paper.bpmn
    ├── Rigid_Employee_Recruitment_V4_Rejected.bpmn
    ├── Flexible_Employee_Recruitment_Process.bpmn
    └── Comparison_Analysis.md
```

## Team Details

**Group 3** — B.Tech IT-BI, Semester 5, IIIT Allahabad

| Name | Roll Number |
|------|-------------|
| Krish Dhaked | IIB2024008 |
| Himanshu Vitthalani | IIB2024009 |
| Mayank Kumar Jha | IIB2024010 |
