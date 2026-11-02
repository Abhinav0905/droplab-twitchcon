# Architecture

DropLab has a dependency-free Node host and a buildless browser application. The static hosted demo uses the same round engine without the host API.

## Round lifecycle

ready → predicting → locked → replaying → reviewing → revealed

Only predicting accepts a prediction. A viewer can update one choice until locking. The lock freezes the question, viewer choices and receipt times and hashes their canonical payload. Reveal is available only after the replay reaches the review phase.

The outcome compares the full manually reviewed timing range with the prediction threshold. A range across the threshold produces an uncertain result. A midpoint is never used to break a close call.

## Twitch path

Twitch IRC WebSocket → tagged command parser → host action queue → round engine → studio and overlay

The reader joins one public channel anonymously. It answers PING and accepts only the exact commands documented in the guide. User IDs identify voters; message IDs reject duplicates. A Twitch command's timestamp must belong to the open round, and the command must arrive before the host locks it. All incoming display names are rendered as text.

The app sends no PRIVMSG commands. It does not post to Twitch, start a broadcast or request a password. If a connected feed is lost during an open round, the studio locks predictions.

## Local host and overlay

The server binds to 127.0.0.1. A new studio session receives a random room ID and a separate random host key. Mutation endpoints require that key and reject a mismatched browser Origin. Operations are serialized per room so a lock and an arriving prediction cannot race through separate state copies.

The overlay URL carries the read-only room ID. Server-sent events provide public snapshots with aggregate counts, question, phase and result. Viewer names, user IDs and message IDs are removed from these snapshots. Host exports include the labelled predictions.

Rooms expire after 12 hours of inactivity and are capped at 30. Predictions are capped at 2,000 per round. Request bodies are capped at 8 KB. State is kept in memory. Media supports byte ranges so browser seeking works.

## Hosted static demo

The browser detects whether the local API is available. Without it, rounds run in that browser and are persisted to localStorage. BroadcastChannel synchronizes a presentation tab in the same browser. That mode is not a cross-device room service or a separate OBS process connection.

## Evidence

The three clips are video-only trims of the creator's recordings. The catalog contains replay timestamps, original-file offsets, reviewed timing windows and SHA-256 hashes. The export ties each reviewed result to its clip hash and locked prediction payload.

The digest supports inspection and mismatch detection. It is not an external timestamp, independent attestation or a guarantee against a malicious host.
