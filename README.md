# GradeCast — AI-powered Assessment Insight Platform  
*(Artificial Neural Network Prediction ＋ Rasch Diagnostics)*

Upload your student–item response data, train neural networks entirely **in-browser** with TensorFlow.js (Holdout / LOOCV), and instantly explore **Rasch / IRT analytics**—including Wright Maps and Infit/Outfit fit statistics—all in an **open-source, privacy-first workflow**.

**Features:**  
CSV upload & column mapping · multi-config training/validation · precise progress bars · new-item prediction · IRT calibration (**Reliability / Variance / Infit / Outfit / t / p**) · Wright Map

By **Linwei Yu**  
The University of Hong Kong · [linweiyu@connect.hku.hk](mailto:linweiyu@connect.hku.hk)

---

## Table of Contents
- [Overview](#overview)
- [Live Stack](#live-stack)
- [Repository Structure](#repository-structure)
- [Quick Start](#quick-start)
- [Data Formats](#data-formats)
  - [Item Descriptive CSV](#item-descriptive-csv)
  - [Student Responses CSV](#student-responses-csv)
- [How to Use](#how-to-use)
- [Model & Validation](#model--validation)
- [Prediction Workflow](#prediction-workflow)
- [IRT Calibration](#irt-calibration)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Troubleshooting](#troubleshooting)
- [Security & Privacy](#security--privacy)
- [Limitations & Future Work](#limitations--future-work)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Overview

**GradeCast** runs entirely in your browser — no backend or installation required.

It enables you to:

1. Upload **Item Descriptive CSV** (e.g., `ItemID`, `Construct`, `Format`, …) and **Student Responses CSV**.
2. Map columns interactively (supports **Long** or **Wide** response format).
3. Configure multiple **Artificial Neural Network (ANN)** architectures and validation schemes (**Holdout / LOOCV**).
4. Train with real-time **progress bars**.
5. Use the **best model** (lowest RMSE) to predict performance for new items.
6. Perform **Rasch / IRT calibration** and visualize results via a **Wright Map**.

All computation happens locally using **TensorFlow.js**, **PapaParse**, **Plotly**, and **TailwindCSS**.

---

## Live Stack

| Layer | Library | Description |
|-------|----------|-------------|
| **UI** | TailwindCSS | Minimal dark tech-style interface |
| **CSV Parsing** | PapaParse | Client-side CSV handling |
| **Machine Learning** | TensorFlow.js | ANN regression and evaluation |
| **Charts** | Plotly.js | Loss curves, scatter plots, Wright Maps |
| **i18n** | In-memory dictionaries | English / Simplified / Traditional Chinese |

---

## Repository Structure

```
/
├─ index.html     # Main entry (UI + containers + CDN deps)
├─ app.js         # Upload/mapping, ANN training, validation, prediction, IRT logic
├─ charts.js      # Plotly charts: loss curve, actual vs. predicted, Wright Map
├─ styles.css     # Minimal CSS; Tailwind handles layout and theme
└─ (CDN-loaded)   # PapaParse / TensorFlow.js / Plotly / Tailwind
```

> Prefer offline vendor scripts? Copy them into `/libs` and update `<script src>` paths in `index.html`.

---

## Quick Start

1. **Download or clone** this repository.  
2. Open `index.html` directly in a modern browser (Chrome / Edge / Firefox).  
3. Upload your CSVs and follow the interface prompts.  

No build or installation steps required.

---

## Data Formats

### Item Descriptive CSV

Used for both **training** and **prediction**; structure must be identical in both.

**Required column**
- `ItemID`

**Optional features** (user-selectable as **categorical** or **numeric**)
- e.g., `Construct`, `Format`, `Domain`, etc.

**Example**
```csv
ItemID,Construct,Format
Delivery.00abc,DCS,CR
Delivery.00ab,DCS,SR
Elevator.02ab,DCS,SR
```

---

### Student Responses CSV

Supports **Long** or **Wide** format.

#### 1) Long Format  
Each row = one (StudentID, ItemID, Score) pair.

```csv
StudentID,ItemID,Score
S001,IC174Q03JA,1
S001,IC183Q16JA,0
S002,IC174Q03JA,1
```

#### 2) Wide Format  
Each row = one Student; columns represent item scores.

```csv
StudentID,IC174Q03JA,IC183Q16JA,ST291Q02JA
S001,1,0,1
S002,1,1,0
```

During training, responses are joined with item descriptives via **ItemID**.  
`StudentID` is also one-hot encoded as a **personalization feature**.

---

## How to Use

### 1) Upload & Map Columns
- **Left:** Upload *Item Descriptive CSV* → choose **ItemID** and feature columns.  
- **Right:** Upload *Student Responses CSV* → choose format (**Long/Wide**) and map columns.  
  - **Long:** `StudentID`, `ItemID`, `Score`  
  - **Wide:** `StudentID`, **item columns** (multi-select)  

Once both files parse successfully (✅), later sections unlock automatically.

---

### 2) Feature Selection
Pick which Item CSV columns to use.  
Each can be marked **categorical** (one-hot) or **numeric**.  
Default: all enabled as categorical.

---

### 3) Model & Validation
Configure:
- Hidden layers (neurons + activation: **ReLU / Tanh / Sigmoid**)
- **Learning Rate**, **Epochs**, **Batch Size**
- **Validation**:
  - **Holdout** (e.g., 80/20 split; model persisted for prediction)
  - **LOOCV** (Leave-One-Out; rigorous evaluation; model not persisted)

---

### 4) Training
Click **Start Training**.

- **Holdout:** epoch-level progress, **loss curves** (train/val), **Predicted vs Actual** scatter, metrics (MAE / MSE / RMSE / R²).  
- **LOOCV:** sample-level progress, final metrics (MAE / MSE / RMSE / R²).

The **best Holdout model** (lowest RMSE) is retained for prediction.

---

### 5) Prediction Workflow
1. Ensure a **Holdout** run was trained (to keep a model).  
2. Upload a **new Item Descriptive CSV** (same columns as training).  
3. The model reuses encoders; unseen categories are ignored (all-zero).  
4. The app generates **(Student × Item)** predictions (preview + CSV export).

---

## IRT Calibration
Run **Compute IRT from Observed Scores** to perform a frontend-friendly Rasch-family approximation (**PCM / RSM**). Calculations use JML-style alternating updates.

**Outputs**
- **Reliability** and **Variance (Persons)**
- **Fit statistics** per item: **Infit / Outfit / t / p**
- **Wright Map**: overlaid histograms of θ (persons) and b (items)
- **Exportable CSV** with item fit indices

> This is designed for realtime diagnostics. For high-stakes calibration, consider full JML/MML implementations.

---

## Model & Validation

**ANN Architecture**
```
Input (one-hot categorical + numeric)
   ↓
Dense(hidden₁, activation)
   ↓
Dense(hidden₂, activation)
   ↓
Dense(1, linear)
```

- Loss: **Mean Squared Error**  
- Optimizer: **Adam** (configurable LR)  
- Validation: **Holdout** (keeps model) / **LOOCV** (no persisted model)

---

## Deploy to GitHub Pages

1. Push the repository to GitHub.  
2. **Settings → Pages**.  
3. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`.  
4. Save and open the generated URL.  
5. The app runs entirely client-side.

---

## Troubleshooting

| Issue | Fix |
|------|-----|
| **Nothing happens after upload** | Upload **both** CSVs and complete mappings for `ItemID`, `StudentID`, and `Score`/item columns. |
| **LOOCV doesn’t keep a model** | Intended behavior. Use **Holdout** if you need prediction. |
| **Predictions look identical** | Ensure selected features vary across items; mark types correctly (categorical vs numeric). |
| **Wright Map looks degenerate** | Verify training produced non-trivial variance in predictions/scores. |
| **Language doesn’t change** | Use the top-right language selector (session-scoped). |

---

## Security & Privacy

- All data stays **in the browser**; no upload to any server.  
- State is in-memory; **close the tab** to clear it.  
- No tracking or external APIs beyond the included CDNs.

---

## Limitations & Future Work

- ANN uses dense layers; deeper/alternative architectures can be added.  
- IRT module is an approximation; replace with JML/MML for formal analyses.  
- Potential enhancements: Kidmap heatmaps, richer reliability diagnostics, PNG export buttons, presets.

---

## License

**MIT License**  
Copyright © 2025 **Linwei Yu**

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.

See the [LICENSE](./LICENSE) file for full details.

---

## Acknowledgments
