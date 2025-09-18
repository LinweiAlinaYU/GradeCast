# GradeCast — Educational Measurement Prediction Platform (ANN Prediction + IRT Calibration)

Open-source platform for educators to upload student–item CSVs, **train & tune** browser-side **ANN** models (TensorFlow.js) with **hold-out** or **LOOCV** validation, and visualize **Rasch/IRT** diagnostics (Kidmap-style predictions, **Wright map**, **Infit/Outfit**).

**Features:** CSV upload & column mapping · multi-config training/validation · precise progress bars · new-item prediction · IRT calibration (**Reliability / Variance / Infit / Outfit / t / p**) · Wright Map

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
- [Internationalization (i18n)](#internationalization-i18n)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Troubleshooting](#troubleshooting)
- [Security & Privacy](#security--privacy)
- [Limitations & Future Work](#limitations--future-work)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Overview

**GradeCast** runs entirely in the browser—no backend needed. It lets you:

1. Upload **Item Descriptive** CSV (e.g., `ItemID`, `Construct`, `Format`, …) and **Student Responses** CSV.
2. Map columns interactively (supports **Long** or **Wide** response format).
3. Configure multiple ANN training setups and validation schemes (**Holdout / LOOCV**).
4. Train with **precise progress bars**.
5. Use the **best model** to predict performance for **new items**.
6. Run **IRT calibration** (lightweight Rasch approximation) and draw a **Wright Map**.

All computation happens locally via **TensorFlow.js**, **PapaParse**, **Plotly**, and **TailwindCSS**.

---

## Live Stack

- **UI:** Tailwind CSS (dark, minimal, techy)
- **CSV:** PapaParse (client-side)
- **ML:** TensorFlow.js (ANN regression)
- **Charts:** Plotly (loss curves, scatter, Wright Map)
- **i18n:** In-memory dictionaries (English, Simplified Chinese, Traditional Chinese)

---

## Repository Structure

/
├─ index.html # Main page (containers + CDN deps)
├─ app.js # Upload/mapping, training/validation, prediction, IRT, progress, i18n glue
├─ charts.js # Plotly charts: loss curve, actual-vs-pred, Wright Map
├─ languages.js # i18n dictionaries (en / zh-CN / zh-TW)
├─ styles.css # Minimal extra CSS; Tailwind handles most styles
└─ (CDN) # PapaParse / TensorFlow.js / Plotly / Tailwind loaded via CDN in index.html


> If you want to self-host vendor scripts, place them under `libs/` and update the `<script src>` tags in `index.html`.

---

## Quick Start

1. Clone or download this repo.  
2. Open `index.html` in a modern browser (or host as a static site).  
3. (Optional) Switch the UI language from the top-right **Language** selector.

No build steps are required.

---

## Data Formats

### Item Descriptive CSV

> Used in **training** and **prediction**; the **structure must be identical** in both stages.

**Required**
- `ItemID`

**Optional categorical features (multi-select)**
- e.g., `Construct`, `Format`, domain tags, source, etc.  
  All selected features are treated as **categorical** and **one-hot encoded**.

**Example**
Student Responses CSV

Supports two shapes:

1) Long format — one row per (Student, Item)
StudentID,ItemID,Score
S001,IC174Q03JA,1
S001,IC183Q16JA,0
S002,IC174Q03JA,1

2) Wide format — one row per Student; item columns hold scores
StudentID,IC174Q03JA,IC183Q16JA,ST291Q02JA
S001,1,0,1
S002,1,1,0

During training, Item Descriptives are joined with Student Responses via ItemID.
For individualized predictions (Kidmap-style), StudentID is also treated as a categorical feature (one-hot).

## How to Use
**1) Upload & Map Columns**

Left: upload Item Descriptive CSV → select Item ID and Feature columns (multi-select).

Right: upload Student Responses CSV → choose format (Long/Wide) and map:

Long: StudentID, ItemID, Score

Wide: StudentID, Item columns (multi-select)

**2) Model Structure**

Configure:

Hidden neurons, Epochs, Batch size, Learning rate, Activation (ReLU / Sigmoid / Tanh)

**3) Validation Configs (add multiple)**

Holdout (Train Ratio %): split train/test; a single model is kept for prediction.

LOOCV (Leave-One-Out): stricter evaluation; no single model is persisted.

**4) Train**

Click Start Training. Watch precise progress bars:

Holdout → epoch-level

LOOCV → sample-level

Each config produces:

Metrics: MAE / MSE / RMSE / R²

(Holdout) Loss curves (train/val)

(Holdout) Predicted vs Actual scatter

**5) Predict New Items**

Upload a new Item Descriptive CSV (same structure as training).
The best Holdout model (lowest RMSE) is used to predict (Student × Item) pairs.

**6) IRT Calibration & Wright Map**

After prediction, the platform runs a lightweight Rasch 1PL approximation and outputs:

- Reliability, Variance (Persons / Items)

- Infit / Outfit / Infit_t / Infit_p / Outfit_t / Outfit_p (table)

- Wright Map (chart + tabular values)

## Model & Validation

**ANN**

- Input: one-hot encoded categorical features (Construct, Format, …, StudentID)

- Architecture: [Dense(hidden, activation)] -> [Dense(1, linear)]

- Loss: Mean Squared Error (regression over scores/probabilities)

- Optimizer: Adam (configurable learning rate)

**Holdout**

- Random shuffle → train/test split by ratio

- Keeps a single model instance for prediction

**LOOCV**

- Iterates leave-one-out across samples

- Provides strict evaluation metrics; no single final model is stored

## Prediction Workflow

1. Use the best Holdout model (lowest RMSE).

2. Upload a new Item Descriptive CSV (same columns as training).

3. The original one-hot dictionaries are reused; unseen categories are ignored (all-zero slot).

4. The app produces (Student × Item) predictions and displays a preview table.

5. Predictions are immediately passed to IRT calibration.

## IRT Calibration

A frontend-friendly approximation to Rasch (1PL) for realtime feedback.
Suitable for quick diagnostics; replace with JML/MML later if you need full parity with specialized IRT software.

## Process

1. Normalize predicted scores to [0, 1] (min-max) and treat them as response probabilities.

2. Alternate updates (gradient-style):

- Estimate θ (persons) and b (items) with logistic link.

3. Fit statistics (per item):

- Standardized residuals: z = (y − p̂) / sqrt(p̂ (1 − p̂))

- Outfit = mean of z²; Infit = information-weighted mean of z²

- t: mean-z approximation; p: normal tail two-sided approximation

- Reliability (rough):

- Rel ≈ Var(θ) / (Var(θ) + mean Var_error)

## Wright Map:

- Overlaid histograms for θ and b on the same (relative) logit scale.

## Outputs

- Summary: Reliability, Variance (Persons / Items)

- Table: Item | Outfit | Outfit_t | Outfit_p | Infit | Infit_t | Infit_p

- Chart: Wright Map

For high-stakes calibration, consider server-side JML/MML or full Rasch packages.
This module is designed for instant insight in the browser.

## Internationalization (i18n)

- Top-right selector: English / 简体中文 / 繁體中文.

- All translatable text uses data-i18n keys bound to dictionaries in languages.js.

- Switching language updates the DOM instantly (no page reload).

## Deploy to GitHub Pages

1. Push the repository to GitHub.

2. Open Settings → Pages:

- Source: Deploy from a branch

- Branch: main (or your branch) / (root)

3. Save and wait for the Pages URL to be generated.

4. Visit the URL; the app runs entirely in the browser.

## Troubleshooting

**- Nothing happens after upload**
Ensure both CSVs are uploaded and column mapping is completed (ItemID, StudentID, Score, features).

**- LOOCV doesn’t keep a model**
By design. Use Holdout if you need a persisted model for prediction.

**- All predictions identical**
Check that selected feature columns are categorical and vary across items.

**- Wright Map looks degenerate**
If predictions have near-zero variance, min-max normalization collapses. Confirm training produced non-trivial outputs.

**- Language doesn’t change**
Use the selector in the header; the change is instant and session-scoped.

## Security & Privacy

- All data stays in the browser; no files are uploaded to any server.

- Close the tab to clear in-memory state.
(You can add optional localStorage persistence in your fork if needed.)

## Limitations & Future Work

- ANN is single-hidden-layer by default (can be extended to deeper nets).

- IRT calibration is an approximation; replace with JML/MML for formal analyses.

- Export (CSV/PNG) can be added (Plotly supports built-in image downloads).

- Add Kidmap heatmaps and richer diagnostics as needed.

## License

Specify your preferred license (e.g., MIT) here.

## Acknowledgments

- TensorFlow.js — in-browser ML

- PapaParse — fast CSV parsing

- Plotly.js — interactive charts

- Tailwind CSS — utility-first styling
