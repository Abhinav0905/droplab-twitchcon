# Building DropLab with Codex

The initial brief was to find a distinctive Twitch community project, challenge the first idea and build within the hackathon window. Five research agents compared audience participation, creator workflows, interactive play, accessibility and unusual physical mechanisms. The chosen direction was a real experiment that chat could predict and inspect.

## The physical test changed the product

Codex first built a webcam color tracker and a timer between two image lines. Generated tests checked frame gaps, ambiguity, tracking loss and impossible jumps. Those tests established software behavior, not physical accuracy.

The creator made a paper helicopter and recorded three initial drops. The camera moved and the white paper blended into the room. The tracker returned no reliable timing. Another batch contained 13 WhatsApp files. Codex extracted time-stamped frames with macOS AVFoundation, reviewed the clips and selected files (3), (4) and (5) on visibility of release, descent and landing.

The decision was to keep the real footage and change the timing claim. The final demo uses manually reviewed release and landing windows. It presents a range, not a falsely precise point. If that range crosses the question's threshold, the result is too close to call.

## What Codex built

- A round state machine: open predictions, lock, replay, review and reveal.
- A read-only Twitch IRC adapter with tagged user identities and strict prediction commands.
- Duplicate-message and late-prediction rejection.
- Separate counts for actual Twitch viewers, on-page practice choices and sample voters.
- A SHA-256 digest of the prediction payload at lock, included in the exported notebook.
- A local host with protected control endpoints and a synchronized, read-only OBS view.
- A browser-only hosted demo using the same round rules and physical clips.
- Release and landing inspection, slow replay, a notebook and next-experiment proposals.
- Node and browser tests, including the uncertain-result case and media seeking.

## What the creator supplied

The physical helicopter, original recordings, permission to use the footage for the hackathon and the Twitch channel name. The creator also performed the requested chat test. Its receipt must be verified separately; a user saying they sent a command is not proof the application accepted it.

## What this prototype does not claim

It does not claim automatic measurement accuracy, a live broadcast of the prerecorded drops, a measured benefit from changing the helicopter design, or a fabricated audience. The next-experiment queue proposes future tests. There is no runtime language model; Codex was used in the build process.
