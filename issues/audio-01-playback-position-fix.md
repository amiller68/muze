# Fix Track Playback Ignoring position_ms

**Status:** Planned
**Dependencies:** None

## Objective

Fix bug where tracks recorded at non-zero positions play back starting at t=0 instead of their correct timeline position.

## Problem

When recording track 2 starting at t=1 (after track 1 ends):
- Waveform correctly shows track 2 at t=1 ✓
- Playback starts track 2 at t=0 ✗

**Root cause:** The `Clip.position_ms` field exists in the frontend type and is used for waveform rendering, but is never passed to the Rust audio engine. The engine treats all audio as starting at sample 0.

## Implementation Steps

### 1. Add position_ms to TrackLoadInfo (`src-tauri/src/commands/mod.rs`)

```rust
#[derive(serde::Deserialize)]
pub struct TrackLoadInfo {
    pub audio_file: Option<String>,
    pub volume: f32,
    pub muted: bool,
    pub position_ms: f64,  // ADD THIS
}
```

### 2. Add position_ms to TrackInfo (`src-tauri/src/commands/mod.rs`)

```rust
pub struct TrackInfo {
    pub audio_path: String,
    pub volume: f32,
    pub muted: bool,
    pub position_ms: f64,  // ADD THIS
}
```

### 3. Pass position through in load_tracks command (`src-tauri/src/commands/mod.rs`)

Update the mapping to include position_ms when creating TrackInfo from TrackLoadInfo.

### 4. Add position_samples to LoadedTrack (`src-tauri/src/audio/engine.rs`)

```rust
pub struct LoadedTrack {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub volume: f32,
    pub muted: bool,
    pub position_samples: usize,  // ADD THIS
}
```

### 5. Convert position_ms to samples when loading (`src-tauri/src/audio/engine.rs`)

In the track loading logic, convert ms to samples:
```rust
position_samples: ((info.position_ms / 1000.0) * sample_rate as f64) as usize
```

### 6. Update playback callback (`src-tauri/src/audio/engine.rs`)

Change the mixing loop from:
```rust
if !track.muted && sample_idx < track.samples.len() {
    mixed_sample += track.samples[sample_idx] * track.volume;
}
```

To:
```rust
if !track.muted && sample_idx >= track.position_samples {
    let track_sample_idx = sample_idx - track.position_samples;
    if track_sample_idx < track.samples.len() {
        mixed_sample += track.samples[track_sample_idx] * track.volume;
    }
}
```

### 7. Update frontend to pass position (`src/services/audioEngine.ts`)

Update TrackInfo interface:
```typescript
export interface TrackInfo {
  audio_file: string | null;
  volume: number;
  muted: boolean;
  position_ms: number;  // ADD THIS
}
```

### 8. Update loadTracksIntoEngine (`src/stores/mixStore.ts`)

```typescript
const tracks = mix.tracks.map((t) => ({
  audio_file: t.clip?.audio_file || null,
  volume: t.volume,
  muted: t.muted,
  position_ms: t.clip?.position_ms || 0,  // ADD THIS
}));
```

## Files to Modify

- `src-tauri/src/commands/mod.rs` - TrackLoadInfo, TrackInfo, load_tracks
- `src-tauri/src/audio/engine.rs` - LoadedTrack, loading logic, playback callback
- `src/services/audioEngine.ts` - TrackInfo interface
- `src/stores/mixStore.ts` - loadTracksIntoEngine function

## Acceptance Criteria

- [ ] TrackLoadInfo includes position_ms
- [ ] LoadedTrack stores position in samples
- [ ] Playback callback offsets sample index by track position
- [ ] Frontend passes clip position when loading tracks
- [ ] Track recorded at t=1 plays back starting at t=1

## Verification

1. Create a new project
2. Record track 1 from t=0 to ~2 seconds
3. Move playhead to t=2
4. Record track 2 starting at t=2
5. Play from beginning - track 2 should be silent until t=2, then play
6. Verify waveform and playback are in sync
7. Test with multiple tracks at various positions
8. Run `make check`
