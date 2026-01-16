# Multi-Track Recording Lag

**Status:** TODO

## Problem

When recording a second track alongside an existing track, the new recording appears offset/lagged behind where it should be in the timeline. The recorded audio doesn't sync properly with existing tracks.

## Root Cause

The recording start position was captured BEFORE playback started:

```typescript
const currentPlayhead = await invoke<number>("get_position");
setRecordingStartMs(currentPlayhead);
// ... other async operations ...
await invoke("play");
```

By the time `play()` executed and audio actually started recording, the playhead had moved forward due to async latency. The clip was then placed at the old position, causing it to appear early relative to when audio was actually captured.

## Solution

Capture the playhead position AFTER playback starts:

```typescript
await invoke("play");
// Capture position AFTER playback starts to avoid latency offset
const currentPlayhead = await invoke<number>("get_position");
setRecordingStartMs(currentPlayhead);
```

## Files Modified

- `src/components/editor/MixEditor.tsx` - Moved position capture after `invoke("play")`

## Acceptance Criteria

- [x] Recording a second track while first track plays back results in aligned audio
- [x] New recording starts at correct timeline position relative to existing tracks

## Notes

There may still be slight latency (~10-50ms) due to inherent audio input buffer latency from the system. A future enhancement could add a configurable latency compensation setting for users with specific audio interfaces.
