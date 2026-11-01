# Calibration Lab — version 0.2

Ten true/false questions to earn a daily streak, **unlimited extra questions**, confidence judgments, Brier loss, a calibration dashboard, and portable data exports.

## Try on a Mac

With Python installed, open Terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. You can also open `index.html` directly for a basic preview, though app installation and offline caching require an HTTP(S) server.

## Put on your iPhone

1. Create a **new GitHub repository** (e.g. `calibration-lab`). It may be public because **your answers are not uploaded to the repository**; only the static code is hosted there. Use a private hosting service if you don't want the code public.
2. Upload **the contents of this folder**, not the folder itself, to the repository root (branch `main`).
3. In the repository: Settings → Pages → Build and deployment → Deploy from a branch → `main` / root. Save and visit the Pages URL that GitHub provides.
4. Open that URL in **Safari on iPhone** → Share → Add to Home Screen → enable Open as Web App → Add.
5. Start recording answers **from the Home Screen app**. Safari and an installed web app may have separate storage; don't assume questions completed in one will appear in the other.

The first question batch needs the internet if no offline cache is available. There is a small built-in offline question bank for testing and offline practice. This version requests fresh true/false questions from [Open Trivia Database](https://opentdb.com/api_config.php), which has a rate limit and may occasionally return errors. Existing local data works offline.

## Data model

- `state.days[YYYY-MM-DD].questions[]` is an ordered, appendable list for a day. New batches are added when you request more questions.
- `state.days[YYYY-MM-DD].responses[]` corresponds to its questions, preserving the *entire probability judgment*.
- Each response contains `kind: "boolean"`, `chosen`, `confidence`, `probTrue`, `correct`, `flagged`, `brier`, and `timestamp`.
- `kind` leaves a path to add multiple-choice or numerical intervals later, without overwriting historical judgments.
- A flagged question remains in history but is removed from calibration metrics.

The Brier loss for this binary question is `(probTrue - actualTrue)^2`. Lower is better. For binary questions, guessing randomly gives expected score 0.25.

## Privacy, reliability, and limits

- No login, tracking, or telemetry, and no app database server.
- Answers are stored using the browser's `localStorage`, not automatically backed up to iCloud or GitHub. **Export JSON regularly** and retain the files somewhere safe. Use JSON restore if moving to another device.
- Source trivia are crowdsourced and can be wrong or ambiguous. Flag any questionable question; the flag excludes it from aggregate scoring.
- The chart is exploratory, not a statistical test of miscalibration. Each confidence bin reports its count; more than 50–100 resolved judgments is preferable.
- The device's local calendar determines each day. Ten answered questions qualify that day for a streak; extra questions remain in the same day and count toward your statistics. A flagged question still counts as answered toward the streak but is excluded from calibration metrics. If all fresh question sources are exhausted, the app offers a retry and preserves your history.
- This is a personal prototype, not production-hardened software. Questions are not independently verified.

## Attribution

Trivia data provided by [Open Trivia Database](https://opentdb.com/), released under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Open Trivia DB data may be used and redistributed subject to that license. Original offline fallback questions are included for convenience.