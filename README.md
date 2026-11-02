# DropLab

Chat predicts. Reality decides.

DropLab is a Twitch audience experiment studio. Viewers predict whether a paper helicopter will stay airborne past a chosen time. The host locks predictions, plays a real recorded drop and reveals a manually reviewed time range. If that range crosses the prediction line, the round is too close to call.

Three physical recordings are included. No camera, API key or Twitch account is needed to try the recorded demo.

## Run

Node.js 22 or newer:

    npm start

Open http://127.0.0.1:8768. The runtime has no package dependencies. The server binds to the local computer only.

1. Open predictions for the first trial at 1.00 seconds.
2. Make a practice prediction or connect Twitch chat.
3. Lock predictions, play the drop and reveal the reviewed result.
4. Inspect the frames and export the experiment.
5. Try the second trial at 1.20 seconds for the "too close to call" case.

The hosted static version runs the same recorded rounds in the browser. It uses browser storage; the local server supports a separate OBS Browser source.

## Twitch

Enter your channel name and choose Connect. The default is kumarabhinav0905.

- !drop yes / !drop no: predict while the round is open.
- !test blades / !test weight / !test repeat: propose the next experiment after the reveal.
- One prediction per Twitch user. Their latest valid command replaces the previous choice before locking.
- Stale messages, duplicate message IDs and predictions received after the lock are rejected.
- The reader uses Twitch IRC over wss://irc-ws.chat.twitch.tv:443 with an anonymous read-only connection. It sends no chat messages.
- Actual Twitch predictions, practice choices and sample voters have separate labels and counts.

Twitch may change anonymous IRC access. A failed connection is displayed rather than replaced with sample traffic. References: [Twitch IRC](https://dev.twitch.tv/docs/chat/irc/) and [read-only anonymous connections](https://discuss.dev.twitch.com/t/noob-question-leaking-oauth/32692).

## OBS overlay

Run the local server on the same computer as OBS. Open the overlay dialog and copy its URL into an OBS Browser source at 1280 × 720. Keep the studio open.

The overlay is read-only. Server-sent events synchronize prediction counts, locked state, replay and result. Host controls require a random session secret, which is not included in the overlay URL. Overlay snapshots omit viewer identities. The server holds sessions in memory; export before restarting it.

The hosted static demo can synchronize another tab in the same browser. A separate OBS browser process needs the local server.

## Measurement and evidence

The footage has camera movement. The prototype color tracker did not produce reliable automatic timings on it. The main app uses manual release and landing windows from frame review.

A result is:

- **Yes** when the entire reviewed range is at or above the prediction line.
- **No** when the entire range is below it.
- **Too close to call** when the range crosses it.

Each exported experiment includes the question, labelled predictions, the locked prediction payload and its SHA-256 digest, source hashes, review windows and next-test votes. This supports inspection and mismatch detection. It is not an independent timestamp service or a tamper-proof competition system.

All three clips show the same helicopter. Release height and hand motion are not controlled enough to establish a design-performance difference. Next-test votes are proposals for future physical trials.

The clips in dist/media are video-only trims of the creator's recordings. Speed is unchanged. The file dist/trials.json records source offsets, review windows and media hashes. Original recordings remain outside the repository.

## Architecture

- dist/studio.js: studio, replay, inspection, practice predictions and export.
- dist/round.js: shared round state machine and commitment generation.
- dist/twitch.js: read-only chat connection and strict command parser.
- server.mjs: dependency-free local host, protected controls, SSE overlay and range-aware media serving.
- dist/trials.json and dist/media/: physical clips and reviewed evidence.
- dist/camera.html, camera.js, camera.css and tracker.js: separate experimental camera tracker.
- test/: state, protocol, server, tracking and browser checks.
- docs/: build decisions and validation notes.

## Test

    npm ci
    npm test
    npm run check
    npm run test:browser

Browser tests use installed Chrome on macOS. Elsewhere, run:

    npx playwright install chromium

Test packages are development-only.

## Data and limits

- No paid services, email collection, login or runtime AI model.
- Codex helped research the concept, write the app, inspect physical clips, revise the measurement approach and test the workflow.
- The app does not broadcast to Twitch. Add its overlay to your streaming software.
- Guest chat support depends on Twitch availability. Disconnection after a successful connection locks an open round.
- The host controls the experiment. There is no monetary wagering or anti-cheat guarantee.
- The hosted demo stores records in its browser; the local host stores state in memory. Export your notebook.
- The camera prototype is experimental. Generated tests do not establish real-world accuracy.
