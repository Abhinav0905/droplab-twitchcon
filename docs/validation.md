# Validation record

Verified locally on November 2, 2026.

## Completed

- 27 Node tests passed: round ordering, prediction changes, lock immutability, digest verification, time-range verdicts, stale and duplicate Twitch messages, read-only public snapshots, host authorization, origin checks, media byte ranges and the retained experimental tracker.
- Six browser scenarios passed in installed Chrome: the complete recorded round, synchronized overlay, exported digest verification, uncertain outcome, below-threshold outcome, clean next round, browser-only fallback, reload persistence, phone layout and a 1280 × 720 overlay. Some scenarios cover more than one behavior.
- Desktop and phone screens were inspected. Mobile has no horizontal overflow.
- The selected clip hashes and review-window ordering were checked against the app catalog.
- Twitch accepted the anonymous read-only connection to kumarabhinav0905 and returned the channel's ROOMSTATE.
- The original footage remains untouched. The app uses video-only trims with unchanged speed.

## Separate checks

A live chat command receipt is checked in a dedicated browser session. Connection confirmation alone does not establish receipt of a viewer prediction.

A synchronized overlay in a browser is not a verified Twitch broadcast. The app does not start a stream.

The first color tracker failed to give reliable timing on the supplied physical recordings. Its generated tests are retained as software tests only. The main demo uses manual frame-review windows and an explicit uncertain result.

## Reproduce

    npm ci
    npm test
    npm run check
    npm run test:browser

For the live read-only test, run the studio, connect your channel, open a round and send !drop yes in that channel's Twitch chat. Confirm that the Twitch count increases while practice and sample counts do not. Lock, replay and reveal; check the same phase on the overlay.
