# Calibration Lab — version 0.6

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

## v0.3 insights update

The confidence calibration plot now includes 95% equal-tailed Bayesian credible intervals for each 10-point confidence bin, based on Jeffreys Beta(1/2,1/2) prior and binomial observations. Each bin lists number correct / total, observed accuracy, and its interval. With few questions, intervals will be wide. Questions within bins are treated as exchangeable; source/category dependence can undermine the nominal interpretation.

The Insights panel also shows a rolling Brier trend with trailing windows of 10, 25, 50 or 100 scored judgments, in chronological order. The daily history remains available. Historical raw answers and `calibration-lab-data-v1` local-storage key are unchanged; there is no reset or migration.

## v0.4 — topic relevance and confidence distribution

New trivia drawn from Open Trivia DB is filtered to General Knowledge, Science & Nature, Computers, Mathematics, Geography, History, Politics, Art, and Animals. Previously downloaded but unanswered questions in the queue from excluded categories are removed at startup. Already answered history is unchanged; questions already allocated to an active daily session may still appear. Use **Skip — not my topic** for those, or any other unsuitable question. Skips do not count toward the daily streak goal or calibration scores.

The Insights tab now includes an 11-bar histogram at 5-percentage-point confidence increments from 50% to 100%, with the count and fraction of 50% answers. Flagged questions are excluded. The app requests 50 mixed-category questions per API call (the API maximum) and keeps only eligible categories, using the offline fallback bank as needed. This topical filter does not independently fact-check trivia; continue flagging ambiguous or incorrect questions.

## v0.5 — subject selection and selective scoring

The Practice tab has a saved multi-subject selection. New questions use the selected topics; existing questions already assigned to today's session remain accessible and may be skipped. For one or two subjects the app requests a specific category from Open Trivia DB, which only supports one category per call; with broader selections the app fetches a mixed group and filters locally. Fallback offline questions respect the same selections. Default practice subjects exclude Other / entertainment.

The Insights tab has a separate multi-subject filter applied retrospectively to stored answers; by default it includes all subjects, including old anime/video-game questions grouped under Other / entertainment. Existing history and streak progress remain unchanged. All plots and summary statistics respond to the Insights subject filter.

Mean Brier excluding exactly 50% confidence reports conditional score only for answers at greater than 50% confidence. The alongside coverage metric is the fraction of subject-filtered scored answers retained. The full Brier is always shown and remains the primary score. The rolling Brier chart can plot either full or conditional Brier. Historic exports remain version 1 with two optional subject-preference fields; importing older backups is backward compatible.

## v0.6 — reliability fix for Keep practicing

Open Trivia DB limits requests to one per IP every five seconds, and may return response code 1 for an oversized category request or code 5 when throttled. The loader now waits between calls, attempts up to three requests, reduces batch size if there are insufficient category questions, and retries when a response contains only previously seen questions. It falls back to unused locally supplied trivia within the selected subjects. When no new questions can be found, the practice screen explicitly reports the issue rather than silently resetting to Keep practicing. All current records, question progress, streaks, and the existing storage key are retained.
