# Title

DropLab

## One-line Summary

Chat predicts. Reality decides. A Twitch experiment studio that locks audience predictions, replays real drops and shows when the evidence is too close to call.

## Problem

Science and maker streams give viewers plenty to watch. It takes more work to give them a clear experiment to join: a question, a prediction before the outcome, a result they can inspect and a choice about what to test next.

A stopwatch on a video can also look more certain than the footage supports. Camera movement, blurred paper and uncertain release frames matter when a drop lasts about a second.

## Solution

DropLab turns a paper helicopter into a small community experiment.

The streamer chooses a prediction line, such as "Will it stay airborne for at least 1.20 seconds?" Viewers type !drop yes or !drop no in Twitch chat. The host locks predictions before the recording plays. The result comes from reviewed release and landing windows.

If the entire timing range falls on one side of the line, the app settles the call. If the range crosses it, the result is "Too close to call." No side wins that round. Viewers can inspect the frames, export the notebook and propose the next physical test.

The current demo contains three real recordings of the same helicopter. They are clearly labelled as replays.

## Why This Matters

A streamer can run a short, repeatable audience activity with paper and a camera. Viewers get a reason to commit to a prediction, watch closely and discuss the result. The uncertainty case is part of the experience: a close call becomes a useful question about evidence.

No audience adoption or educational-outcome claim has been measured.

## How We Used AI

There is no runtime language model in this version. Codex was the development tool. Physical recordings and reviewed frames supply the evidence; an AI model does not invent the result.

## How We Used Codex

Codex helped compare five possible directions and challenge the initial concept. It built the first camera tracker, inspected the physical recordings, identified background confusion and revised the product around manually reviewed timing ranges.

Codex then implemented the round state machine, Twitch command reader, prediction lock digest, synchronized overlay, evidence inspection and export. It wrote and ran the Node and browser checks and reviewed the desktop and phone layouts.

The creator made the paper helicopter, recorded the trials and supplied the Twitch channel.

## Key Features

- Read-only Twitch chat: !drop yes and !drop no.
- One prediction per viewer, editable until the host locks the round.
- Explicit rejection of duplicate, stale and late predictions.
- Three recorded physical trials with visible release and landing.
- A reviewed time range and a "Too close to call" result.
- Clearly separated Twitch, practice and sample predictions.
- Read-only stream overlay synchronized through the local host.
- Release/landing inspection and slow replay.
- Exported notebook with prediction payload, lock digest, clip hashes and timing windows.
- Chat proposals for the next physical test.

## Architecture

Buildless HTML, CSS and JavaScript. A shared JavaScript state machine runs in the local Node host or the browser-only demo. Twitch IRC provides the read-only chat feed. The local host protects mutation endpoints with a session key and sends public state to the OBS overlay through server-sent events.

No runtime dependencies, paid APIs, database setup or model key are required.

## Testing Instructions

Use Node.js 22 or newer. Clone the repository and run npm start, then open http://127.0.0.1:8768.

Open predictions, make a practice choice, lock, play and reveal. The first default round resolves Yes. The second produces "Too close to call." The third resolves No. Inspect the evidence and export the notebook.

To test Twitch, connect your own channel and send !drop yes in its chat while predictions are open. Check that the Twitch count increases. To test the overlay, open it from the studio, then confirm that locking and revealing update both views.

Run npm ci, npm test, npm run check and npm run test:browser for the automated checks.

## Public Demo Link

Pending public release. A private hosted preview is being prepared.

## Public Repository Link

Pending repository release. The source package includes the application, test code, three replay clips and run instructions.

## Demo Video

Pending rendered walkthrough and public YouTube URL. Maximum length: three minutes.

Planned sequence:
1. The question and a real helicopter recording.
2. Twitch channel connection and a labelled prediction.
3. Lock, replay and result on the studio and overlay.
4. The uncertain trial and its review windows.
5. How Codex changed the measurement approach and tested the app.

## Screenshot Shot List

1. Studio with predictions open.
2. Locked predictions and their digest.
3. Revealed result on the stream overlay.
4. "Too close to call" with the reviewed time range.
5. Release and landing inspection.

## Submission Readiness Notes

The app and included recorded-round flow work locally. Automated checks and browser tests are recorded in docs/validation.md.

The Twitch channel connection was confirmed. A real command receipt and any actual broadcast footage must be reported separately based on verified results.

Publication and the final Devpost action remain separate from this draft.

## Known Limitations

- The physical recordings are prerecorded, not a live broadcast.
- Timing comes from manual frame review. Automatic camera accuracy is not validated.
- Three recordings of the same helicopter do not establish a design-performance difference.
- Next-experiment votes are proposals, not completed tests of changed designs.
- The hosted browser demo shares state within one browser. A separate OBS process uses the local Node host.
- The export digest is inspectable but is not an independent timestamp or anti-cheat guarantee.
- Anonymous Twitch IRC access depends on Twitch continuing to provide it.

## TODO Official Form Fields

29286 — Submitter Type: confirm Individual or Team of Individuals.
29287 — Submitter Country of Residence: participant answer required.
29288 — Code repository URL: pending release.
29289 — Codex session ID: candidate 01a19051-0977-7ff1-8a7c-b88e73771f41, read from this process's CODEX_THREAD_ID and CODEX_SESSION_ID. Participant confirmation is still required before using it in the form.
29290 — Technology requirement answer: Codex was used to research, implement, inspect physical footage and test DropLab. Twitch IRC supplies read-only chat commands; a synchronized browser overlay presents the experiment on stream. The demonstration recordings use manual timing windows.
29291 — Streamer/community use answer: The streamer opens a question and locks predictions before the drop. Viewers use !drop yes or !drop no in Twitch chat, inspect the result and propose the next experiment with !test commands.
29292 — Skills/knowledge gained: participant answer required.
29293 — Likelihood of using Codex again: participant answer required.
29294 — Age of majority: participant confirmation required.
29295 — Eligible jurisdiction: participant confirmation required.
29296 — Not an employee/representative/agent of the sponsors: participant confirmation required.
