# Calibration Lab

A small personal iPhone-friendly calibration game: ten true/false trivia judgments per day, with stated confidence, immediate feedback, Brier scores, and long-run calibration charts.

## Install on iPhone

1. Open **Settings → Pages** in this GitHub repository.
2. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then tap **Save**.
3. Once published, open **https://freireib.github.io/calibration-lab/** in Safari.
4. Tap Share → **Add to Home Screen**, enable **Open as Web App** if prompted, then tap Add.

You can also run this site locally with `python3 -m http.server 8000`.

## How it works

- Ten new true/false questions per calendar day.
- Choose True/False and assign 50–100% confidence that your chosen answer is correct.
- Feedback is revealed only after submitting; the response is saved first.
- A daily Brier loss and a calibration-versus-confidence plot track performance over time.
- You may flag an ambiguous or incorrect question; flagged responses are excluded from aggregate scores.
- Question source: [Open Trivia DB](https://opentdb.com/) (CC BY-SA 4.0) with a small offline fallback bank.

## Your data

Answers are stored **locally in the browser/Home Screen app** using localStorage. They are not uploaded to GitHub or synchronized with your devices. Use the **History & data** tab to export a JSON backup periodically, or CSV for analysis in Python. Restore JSON to move between devices.

The dashboard is exploratory; after only a few sessions its calibration bins are noisy. Multiple-choice and interval-estimation formats can be added later.

## Privacy and caveats

This repository contains source code only, no personal results. Anyone can view the code because GitHub Pages is being used for free hosting. Question quality is not independently verified; flag unreliable questions.
