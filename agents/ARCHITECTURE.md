# Muse Architecture

## Overview

Muse is a multi-track audio recorder with a SolidJS frontend and Rust/Tauri backend. It supports iOS (via AltStore) and desktop (macOS/Linux).

```
┌─────────────────────────────────────┐
│     SolidJS Frontend (src/)         │
│  App.tsx → MixEditor.tsx            │
│  useMixStore() → audioEngine.ts     │
└──────────────┬──────────────────────┘
               │ Tauri IPC (invoke)
┌──────────────▼──────────────────────┐
│     Rust Backend (src-tauri/)       │
│  commands/ → project/ → audio/      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     File System                      │
│  ~/Music/Muze/ or ~/Documents/Muze/ │
└─────────────────────────────────────┘
```

---

## Data Hierarchy

```
Collection/           # Optional grouping
  └── Project/        # Contains related mixes
       └── Mix/       # The audio project
            ├── mix.json      # Metadata + track config
            └── audio/        # WAV files
                 ├── track_0_*.wav
                 └── track_1_*.wav
```

---

## Frontend Structure

### View Modes

`App.tsx` manages three views:
- **browser**: File browser for collections/projects/mixes
- **project**: List of mixes within a project
- **editor**: `MixEditor.tsx` for recording/playback

### State Management

`useMixStore()` in `stores/mixStore.ts`:

```typescript
// Signals (reactive)
currentMix: Mix | null
mixPath: string | null
isDirty: boolean
selectedTrack: number

// Actions
loadMix(path)      // Load from disk
saveMix()          // Persist to disk (debounced)
addTrack()         // Add new track (max 8)
updateTrackVolume(idx, vol)
```

### Tauri IPC

All backend calls use `invoke()`:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Load a mix
const mix = await invoke<Mix>("load_project", { projectPath });

// Start recording
const filename = await invoke<string>("start_recording", { trackIndex, projectPath });
```

---

## Backend Structure

### Command Registration

`lib.rs` registers ~30 Tauri commands:

```rust
// Transport
play, pause, stop, seek, get_position, is_playing

// Recording
start_recording, stop_recording, is_recording, get_input_level

// Project management
create_project, load_project, save_project, list_projects

// Audio processing
load_tracks, export_mix_to_file, export_and_share
```

### Audio Engine

`audio/engine.rs` uses a multi-threaded architecture:

```rust
AudioEngine {
    shared_state: Arc<SharedState>,  // Atomic playhead, levels
    command_tx: Sender<AudioCommand>, // Play, Pause, LoadTracks
}

// Runs on dedicated thread
loop {
    match command_rx.recv() {
        AudioCommand::Play => ...,
        AudioCommand::LoadTracks(tracks) => ...,
    }
}
```

### Data Models

`project/model.rs` defines serializable types:

```rust
Mix {
    id: Uuid,
    name: String,
    sample_rate: u32,      // Always 48000
    tracks: Vec<Track>,
}

Track {
    id: Uuid,
    volume: f32,           // 0.0 - 1.0
    muted: bool,
    solo: bool,
    clip: Option<Clip>,
}

Clip {
    audio_file: String,    // Relative path
    original_duration_ms: u64,
    trim_start_ms: u64,
    trim_end_ms: u64,
}
```

---

## Type Mapping

Types are mirrored between TypeScript and Rust:

| TypeScript (`src/types/`) | Rust (`project/model.rs`) |
|---------------------------|---------------------------|
| `Mix` | `Mix` |
| `Track` | `Track` |
| `Clip` | `Clip` |
| `FolderEntry` | `FolderEntry` |

**Keep these in sync.** Mismatches cause runtime errors.

---

## Key Patterns

### Auto-Save (Frontend)

```typescript
// In mixStore.ts
const debouncedSave = debounce(async () => {
    await invoke("save_project", { project: mix, projectPath });
}, AUTO_SAVE_DEBOUNCE_MS); // 300ms
```

### Playhead Polling (Frontend)

```typescript
// MixEditor.tsx
setInterval(async () => {
    const pos = await invoke<number>("get_position");
    setPosition(pos);
}, POSITION_POLL_MS); // 30ms
```

### Atomic State (Backend)

```rust
// No locks for hot path
shared_state.playhead_samples.fetch_add(frames, Ordering::SeqCst);
shared_state.is_playing.load(Ordering::SeqCst);
```

---

## Constants

```typescript
// src/constants/config.ts
TRACK_LIMIT = 8              // Max tracks per mix
POSITION_POLL_MS = 30        // Playhead update interval
LEVEL_POLL_MS = 50           // Input level sampling
AUTO_SAVE_DEBOUNCE_MS = 300  // Save debounce
MIN_TIMELINE_MS = 15000      // Default timeline view
ZOOM_MIN = 0.25, ZOOM_MAX = 8
```
