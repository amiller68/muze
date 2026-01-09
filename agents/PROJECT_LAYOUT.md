# Project Layout

## Root Structure

```
muse/
├── src/                    # SolidJS frontend
├── src-tauri/              # Rust backend
├── agents/                 # This documentation
├── .github/workflows/      # CI configuration
├── Makefile                # Build commands
├── package.json            # Frontend dependencies
├── biome.json              # TypeScript linting
├── vite.config.ts          # Bundler config
├── tailwind.config.js      # Styling
└── tsconfig.json           # TypeScript config
```

---

## Frontend (`src/`)

```
src/
├── App.tsx                 # Main app, navigation, file browser
├── index.tsx               # Entry point
│
├── components/
│   └── editor/
│       ├── MixEditor.tsx       # Audio editor (timeline, waveforms)
│       └── TrackSettingsModal.tsx  # Track controls modal
│
├── stores/
│   └── mixStore.ts         # Global state (mix, tracks, dirty flag)
│
├── services/
│   └── audioEngine.ts      # Tauri invoke wrappers
│
├── types/
│   ├── index.ts            # Re-exports
│   ├── mix.ts              # Mix, Track, Clip, CutRegion
│   ├── collection.ts       # Collection, Project types
│   └── navigation.ts       # NavLocation, FolderEntry
│
├── constants/
│   ├── config.ts           # App constants (limits, intervals)
│   └── theme.ts            # Colors
│
├── utils/
│   ├── time.ts             # formatTime, formatTimeShort
│   └── time.test.ts        # Tests
│
└── styles/
    └── global.css          # Tailwind + custom styles
```

### Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Navigation between browser/project/editor views |
| `MixEditor.tsx` | Recording, playback, timeline visualization |
| `mixStore.ts` | State management, auto-save logic |
| `audioEngine.ts` | Type-safe Tauri invoke wrappers |
| `config.ts` | Constants like `TRACK_LIMIT`, `POSITION_POLL_MS` |

---

## Backend (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── main.rs             # Tauri app entry
│   ├── lib.rs              # Command registration
│   │
│   ├── commands/
│   │   └── mod.rs          # All Tauri command handlers
│   │
│   ├── project/
│   │   ├── mod.rs          # CRUD operations (create/load/save)
│   │   └── model.rs        # Data structures (Mix, Track, Clip)
│   │
│   └── audio/
│       ├── mod.rs          # Module exports
│       ├── engine.rs       # AudioEngine (playback/recording)
│       ├── recorder.rs     # WAV operations (splice, trim, export)
│       └── ios_audio.rs    # iOS audio session, share sheet
│
├── Cargo.toml              # Rust dependencies
├── tauri.conf.json         # Tauri configuration
└── capabilities/           # Tauri permissions
```

### Key Files

| File | Purpose |
|------|---------|
| `lib.rs` | Registers ~30 Tauri commands |
| `commands/mod.rs` | Command implementations |
| `model.rs` | `Mix`, `Track`, `Clip` structs with serde |
| `engine.rs` | Multi-threaded audio engine using CPAL |
| `recorder.rs` | WAV encoding via Hound |

---

## File System Layout (Runtime)

```
~/Music/Muze/                   # macOS/Linux
~/Documents/Muze/               # iOS

MyCollection/
├── collection.json
└── MyProject/
    ├── project.json
    └── MyMix/
        ├── mix.json            # Track config, metadata
        ├── audio/
        │   ├── track_0_abc123.wav
        │   └── track_1_def456.wav
        └── export_1234567890.wav
```

### JSON Schemas

**mix.json**:
```json
{
  "version": "1.0",
  "id": "uuid",
  "name": "My Mix",
  "sample_rate": 48000,
  "tracks": [
    {
      "id": "uuid",
      "name": "Track 1",
      "volume": 0.8,
      "muted": false,
      "clip": {
        "audio_file": "track_0_abc123.wav",
        "original_duration_ms": 5000
      }
    }
  ]
}
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `Makefile` | `check`, `lint`, `fmt`, `test`, `build`, `dev` |
| `biome.json` | TypeScript linting (replaces ESLint + Prettier) |
| `vitest.config.ts` | Frontend test configuration |
| `tailwind.config.js` | CSS utility classes |
| `tauri.conf.json` | App ID, permissions, build settings |
