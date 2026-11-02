# Validation record

Verified locally on November 2, 2026.

## Completed

- 27 Node tests passed: round ordering, prediction changes, lock immutability, digest verification, time-range verdicts, stale and duplicate Twitch messages, read-only public snapshots, host authorization, origin checks, media byte ranges and the retained experimental tracker.
- Six browser scenarios passed in installed Chrome: the complete recorded round, synchronized overlay, exported digest verification, uncertain outcome, below-threshold outcome, clean next round, browser-only fallback, reload persistence, phone layout and a 1280 × 720 overlay. Some scenarios cover more than one behavior.
- Desktop and phone screens were inspected. Mobile has no horizontal overflow.
- The selected clip hashes and review-window ordering were checked against the app catalog.
- Twitch accepted the anonymous read-only connection to kumarabhinav0905 and returned the channel's ROOMSTATE.
- The original footage remains untouched. The app uses video-only trims with unchanged speed.

## Published demo and video

- The website and GitHub repository were made public with creator approval on November 2, 2026. Both returned HTTP 200 without account credentials.
- A fresh browser opened the public demo, completed a practice round and reached RESULT REVEALED with no page errors. That hosted check contained 0 Twitch, 1 practice and 0 sample predictions.
- The narrated demo is 158.32 seconds at 1440 × 810, 25 fps. It includes captures from the separately verified real Twitch round. Video frames and the decoded audio track were checked. Public YouTube upload is still pending.

## Separate checks

A live chat command was received on November 2, 2026 at 08:07 UTC from kumarabhinav0905. The round contained 1 Twitch prediction, 0 practice predictions and 0 sample predictions. The host locked it, played the physical recording and revealed Yes. A separate overlay received the same locked round and result. See [the exported notebook](evidence/live-twitch-experiment.json) and [the verification status](evidence/live-twitch-status.json).

The earlier connection-only attempts did not receive a command. Only the successful round above is counted as live chat evidence.

A synchronized overlay in a browser is not a verified Twitch broadcast. The app does not start a stream.

The first color tracker failed to give reliable timing on the supplied physical recordings. Its generated tests are retained as software tests only. The main demo uses manual frame-review windows and an explicit uncertain result.

## Reproduce

    npm ci
    npm test
    npm run check
    npm run test:browser

For the live read-only test, run the studio, connect your channel, open a round and send !drop yes in that channel's Twitch chat. Confirm that the Twitch count increases while practice and sample counts do not. Lock, replay and reveal; check the same phase on the overlay.
