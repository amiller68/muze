# Key Concepts

High-level domain concepts for understanding Muse.

## Overview

Muse is a multi-track audio recorder that runs on iOS (via AltStore) and desktop (macOS/Linux). Users create mixes with up to 8 tracks, record audio clips, and export finished projects.

---

## Domain Model

### Data Hierarchy

```
Collection/           # Optional grouping of projects
  └── Project/        # Container for related mixes
       └── Mix/       # The audio project
            ├── Track 1
            │    └── Clip (audio file)
            ├── Track 2
            │    └── Clip (audio file)
            └── ...
```

### Mix

The top-level audio project. A mix contains:
- **Metadata**: Name, unique ID, sample rate (always 48kHz)
- **Tracks**: Up to 8 audio tracks
- **File**: Stored as `mix.json` with audio in an `audio/` subdirectory

### Track

A single lane in the mix. Each track has:
- **Volume**: 0.0 to 1.0
- **Mute/Solo**: Playback control flags
- **Clip**: Optional audio content

Tracks are identified by index (0-7) and have assigned colors for UI display.

### Clip

Audio content within a track:
- **Audio file**: WAV file reference (relative path)
- **Duration**: Original length in milliseconds
- **Trim**: Optional start/end trim points

---

## Audio Engine Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (SolidJS)                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  MixEditor  │    │  mixStore   │    │audioEngine  │   │
│  │   (UI)      │───→│  (state)    │───→│ (invoke)    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ Tauri IPC
┌──────────────────────────▼───────────────────────────────┐
│                     Backend (Rust)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  commands   │───→│ AudioEngine │───→│    CPAL     │   │
│  │  (handlers) │    │  (thread)   │    │  (hardware) │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Frontend Layer

1. **MixEditor**: Timeline UI, waveform display, transport controls
2. **mixStore**: Reactive state management (SolidJS signals)
3. **audioEngine**: Type-safe wrappers for Tauri `invoke()` calls

### Backend Layer

1. **commands**: Tauri command handlers (~30 commands)
2. **AudioEngine**: Multi-threaded playback/recording engine
3. **CPAL**: Cross-platform audio I/O

### Communication

All frontend-backend communication uses Tauri's `invoke()` IPC:
- Commands are registered in `lib.rs`
- TypeScript types must match Rust types exactly
- Errors are returned as strings

---

## State Management

### Frontend State (mixStore)

```typescript
// Reactive signals
currentMix: Mix | null      // The loaded mix
mixPath: string | null      // File path
isDirty: boolean            // Unsaved changes flag
selectedTrack: number       // Currently selected track index

// Actions
loadMix(path)               // Load from disk
saveMix()                   // Save to disk (debounced)
addTrack()                  // Add new track
updateTrackVolume(idx, vol) // Modify track
```

### Backend State (AudioEngine)

```rust
// Shared state (atomic, lock-free)
playhead_samples: AtomicU64  // Current position
is_playing: AtomicBool       // Playback state
input_level: AtomicU16       // Recording level meter

// Command channel
command_tx: Sender<AudioCommand>  // Play, Pause, LoadTracks, etc.
```

---

## Platform Considerations

### Desktop (macOS/Linux)
- Data stored in `~/Music/Muze/`
- Standard CPAL audio device selection
- File browser for project management

### iOS (via AltStore)
- Data stored in `~/Documents/Muze/`
- iOS audio session management
- Share sheet for exports
- Different touch interaction patterns

### Cross-Platform Patterns
- All file paths are relative within projects
- Sample rate is fixed at 48kHz for consistency
- WAV format for universal compatibility

---

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `TRACK_LIMIT` | 8 | Maximum tracks per mix |
| `POSITION_POLL_MS` | 30 | Playhead update interval |
| `LEVEL_POLL_MS` | 50 | Input level sampling |
| `AUTO_SAVE_DEBOUNCE_MS` | 300 | Save debounce delay |
| Sample rate | 48000 Hz | Fixed for all mixes |

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical implementation details
- [PROJECT_LAYOUT.md](./PROJECT_LAYOUT.md) - File organization
- [INDEX.md](./INDEX.md) - Documentation navigation
