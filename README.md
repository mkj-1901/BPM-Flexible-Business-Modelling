# BPM-Flexible-Business-Modelling

BPM Course Final Project (**Group 3**) exploring **flexible business process modeling** with optional and alternative activities in **BPMN 2.0**, plus an interactive web tool (**BPM Flexible vs. Rigid Modelling Studio**) that generates rigid vs. flexible BPMN 2.0 diagrams and `Comparison_Analysis.md` from natural-language prompts.

## Overview

Instead of maintaining separate rigid BPMN diagrams for every operational variant, this project applies **flexibility by selection** (using labelled XOR gateways, FEEL guard conditions, and bypass flows) to consolidate multiple process variants into a single unified BPMN model across three domains:

1. **Loan Application Process** (`Loan Process/`) — Merges 4 variants (*Standard branch*, *Digital fast-track*, *Legacy paper-file*, *High-risk rejected*) into 1 unified model (`22 → 9` activities, `30 → 19` total nodes, `26 → 22` sequence flows).
2. **University Admission Process** (`University Admission Process/`) — Merges 4 variants (*Standard Admission*, *Online Fast-Track*, *Legacy Paper-Based*, *Rejected Application*) into 1 unified model (`21 → 10` activities, `29 → 22` total nodes, `25 → 27` sequence flows).
3. **Employee Recruitment Process** (`Employee Recruitment Process/`) — Merges 4 variants (*Standard Corporate Hire*, *Remote Fast-Track Hire*, *Legacy Paper-Dossier Hire*, *Rejected Candidate*) into 1 unified model (`22 → 9` activities, `30 → 19` total nodes, `26 → 22` sequence flows).

## BPM Flexible vs. Rigid Modelling Studio (Web Tool)

The repository includes a zero-dependency Node.js backend + web frontend (`server.js`, `src/`, `public/`) that converts any natural-language business process description (or explicit variant trace lines) into:

- **Unified Flexible BPMN 2.0 Diagram** (interactive SVG viewer with variant trace highlighting, FEEL guard labels, zoom controls, SVG & `.bpmn` download)
- **Rigid Baseline BPMN 2.0 Diagrams** (one separate sequential diagram per process variant)
- **Comparison Statistics & Trace Verification** (Table I variant sequences, Activity Classification, Table III trace verification, and Table IV structural comparison metrics)
- **`Comparison_Analysis.md`** (formatted preview, raw Markdown copy/download) and **`.zip` bundle export** containing all generated `.bpmn` and `.md` files

### Prerequisites

- **Node.js `>= 20.0.0`** (verify with `node -v`)
- No `npm install` step is required — the backend and frontend use built-in Node.js modules and vanilla HTML/CSS/JS.
- *(Optional)* A Gemini API key (`AIza...` or `AQ....` from [Google AI Studio](https://aistudio.google.com/apikey), or a Vertex AI Express Mode `AQ....` key). Without an API key, the app runs offline using the built-in local rule-based BPM parser.

### How to Run on Your System

1. **Open the repository folder**
   ```bash
   git clone <repository-url>
   cd BPM-Flexible-Business-Modelling
   ```

2. **Create and configure `.env`**
   Copy `.env.example` to `.env`:
   - **Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   - **macOS / Linux:**
     ```bash
     cp .env.example .env
     ```

   Open `.env` and set your API key:
   ```env
   API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-3.5-flash
   PORT=3000
   ```
   - **Key & endpoint support:**
     - `AIza...` keys route to Google AI Studio / Gemini Developer API (`generativelanguage.googleapis.com`).
     - `AQ....` keys are auto-detected (trying `generativelanguage.googleapis.com` first and falling back to Vertex AI Express Mode `aiplatform.googleapis.com` if needed), or you can force one via `GEMINI_PROVIDER=gemini-developer` or `GEMINI_PROVIDER=vertex-express` in `.env`.
   - **Security:** `.env` is listed in `.gitignore` so your API key is never committed to Git. You can verify this with `git check-ignore .env`.

3. **Start the application**
   ```bash
   npm start
   ```
   *(or `node server.js`)*

   On startup, the terminal displays the listening URL and API configuration status:
   ```text
   BPM Flexible Modelling Studio listening at http://localhost:3000
   Gemini API key status: configured (API_KEY, provider=auto, model=gemini-3.5-flash)
   ```

4. **Open the frontend in your browser**
   Visit **[http://localhost:3000](http://localhost:3000)**.

5. **Generate diagrams & comparison stats**
   - Select one of the built-in presets or enter a natural-language process prompt (e.g., activities, optional steps, and alternative branches, or explicit `V1: Task A -> Task B` lines).
   - Pick the backend engine (**Auto**, **Gemini API (LLM)**, or **Local Rule-Based Parser**).
   - Click **Generate Diagrams & Comparison** (or **Load Exact Repo Reference** for the three repository case studies).
   - Explore the **Sample BPMN Diagrams**, **Comparison Stats & Traces**, **Comparison_Analysis.md**, and **BPMN 2.0 XML Inspector** tabs, or click **Download All (.zip)**.

### Troubleshooting

- **Port already in use:** Change `PORT=3001` in `.env` and restart `npm start`.
- **Header shows "No API_KEY in .env" or "placeholder in .env":** Ensure `.env` exists in the repository root with `API_KEY=<your_real_key>`, then restart the server.
- **Model unavailable / 404 or high-demand 503:** Set `GEMINI_MODEL=gemini-3.5-flash` (or `gemini-3-flash-preview`) in `.env`; the backend also automatically falls back to healthy Gemini Flash models on transient 503/404 responses.
- **No external internet / offline mode:** Switch the **Backend Engine** dropdown to **Local Rule-Based Parser (Offline)** (or leave `API_KEY` empty in `.env` and use **Auto** mode).

### Deploy to Vercel

1. Push the repository to GitHub (note: `.env` is ignored by `.gitignore` and will not be committed).
2. Import the repository in [Vercel](https://vercel.com/new) with **Framework Preset: Other** (zero build step needed; `vercel.json` routes `/api/*` to `api/index.js` and serves `public/` statically).
3. Under **Project Settings → Environment Variables**, add:
   - `API_KEY` = `<your_gemini_api_key>`
   - *(Optional)* `GEMINI_MODEL` = `gemini-3.5-flash`
4. Deploy — Vercel will serve the frontend and `/api/*` serverless endpoints automatically.

## Repository Structure

```
BPM-Flexible-Business-Modelling/
├── README.md
├── Report-BPM.pdf
├── package.json
├── vercel.json
├── server.js
├── api/
│   └── index.js           # Vercel serverless API entrypoint
├── .env.example
├── .gitignore
├── src/
│   ├── engine.js          # BPMN 2.0 graph builder, metrics, trace verifier & Markdown/XML generator
│   ├── env.js             # .env loader and API_KEY / provider config
│   ├── gemini.js          # Gemini Developer API & Vertex AI Express Mode client
│   ├── localParser.js     # Offline natural-language & variant-trace parser
│   ├── presets.js         # Repository case studies & sample natural-language prompts
│   └── zip.js             # Pure-JS ZIP archive builder for exporting bundles
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js             # Frontend UI, interactive BPMN SVG renderer & exports
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
