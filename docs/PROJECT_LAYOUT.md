# Project Layout

Overview of the codebase structure.

## Directory Structure

```
muse/
├── src/                        # Frontend (SolidJS + TypeScript + Tailwind)
│   ├── components/             # UI components
│   │   ├── editor/             # Mix editor (MixEditor, Waveform, TrackSettingsModal)
│   │   └── sidebar/            # Navigation (Sidebar, FileTree, VaultSwitcher)
│   ├── stores/                 # SolidJS reactive stores
│   │   ├── mixStore.ts         # Mix/track state management
│   │   └── vaultStore.ts       # Vault/storage state
│   ├── types/                  # TypeScript interfaces
│   │   ├── mix.ts              # Mix, Track, Clip, CutRegion
│   │   ├── collection.ts       # Collection types
│   │   ├── vault.ts            # Vault, VaultProvider
│   │   ├── navigation.ts       # FolderEntry types
│   │   └── index.ts            # Re-exports
│   ├── services/               # Service layer
│   │   ├── audioEngine.ts      # Audio engine wrapper
│   │   └── vaultService.ts     # Vault operations
│   ├── utils/                  # Utility functions
│   │   └── time.ts             # formatTime, formatTimeShort
│   ├── constants/              # Configuration values
│   │   ├── theme.ts            # Colors, track colors
│   │   └── config.ts           # AUTO_SAVE_DEBOUNCE_MS, etc.
│   ├── styles/                 # CSS styles
│   │   └── global.css          # Tailwind imports
│   ├── test/                   # Test setup
│   │   └── setup.ts            # Tauri mocks for Vitest
│   ├── App.tsx                 # Main app component
│   └── index.tsx               # Entry point
│
├── src-tauri/                  # Backend (Rust + Tauri 2.0)
│   ├── src/
│   │   ├── lib.rs              # App initialization, command registration
│   │   ├── main.rs             # Binary entry point
│   │   ├── audio/              # Audio engine
│   │   │   ├── mod.rs          # Module exports
│   │   │   ├── engine.rs       # AudioEngine (playback, mixing)
│   │   │   ├── recorder.rs     # Recording, splicing, export
│   │   │   └── ios_audio.rs    # iOS audio session config
│   │   ├── commands/           # Tauri IPC commands
│   │   │   └── mod.rs          # All command handlers
│   │   ├── project/            # Data models
│   │   │   ├── mod.rs          # Collection/mix operations
│   │   │   └── model.rs        # Mix, Track, Clip, Collection structs
│   │   └── vault/              # Multi-vault storage
│   │       ├── mod.rs          # Vault operations
│   │       └── model.rs        # Vault, VaultProvider structs
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
│
├── docs/                       # Documentation
├── issues/                     # File-based issue tracking
├── .claude/                    # Claude Code configuration
│   ├── settings.json           # Permissions
│   └── skills/                 # Custom skills
│
├── Makefile                    # Build/test commands
├── package.json                # Node dependencies, npm scripts
├── tsconfig.json               # TypeScript configuration
├── biome.json                  # Linting/formatting config
├── vite.config.ts              # Vite bundler config
├── vitest.config.ts            # Test framework config
├── tailwind.config.js          # Tailwind CSS config
└── postcss.config.js           # PostCSS config
```

## Key Files

- `src/App.tsx` — Main app component with browser/editor views and navigation
- `src/stores/mixStore.ts` — Mix state management, track operations
- `src-tauri/src/lib.rs` — Tauri app initialization, command registration
- `src-tauri/src/audio/engine.rs` — Core audio engine (playback, mixing)
- `src-tauri/src/commands/mod.rs` — All Tauri IPC command handlers

## Entry Points

- **Frontend**: `src/index.tsx` → mounts `App` to `#root`
- **Backend**: `src-tauri/src/lib.rs` → `pub fn run()`
- **Binary**: `src-tauri/src/main.rs` (for testing without Tauri)
- **Mobile**: Tauri auto-generates via `#[cfg_attr(mobile, tauri::mobile_entry_point)]`

## Configuration

| File | Purpose |
|------|---------|
| `package.json` | Node dependencies, npm scripts |
| `Cargo.toml` | Rust dependencies |
| `tsconfig.json` | TypeScript compiler options (strict mode) |
| `biome.json` | Linting rules, formatting options |
| `vite.config.ts` | Vite dev server, Solid plugin |
| `vitest.config.ts` | Test environment, setup files |
| `tailwind.config.js` | Tailwind CSS customization |
| `tauri.conf.json` | Tauri app metadata, permissions |

## Tests

- **Frontend**: `src/**/*.test.ts`, `src/**/*.test.tsx`
- **Setup**: `src/test/setup.ts` (Tauri mocks)
- **Backend**: Inline tests in Rust files via `#[cfg(test)]`

## Build Output

- `dist/` — Vite production build (frontend)
- `src-tauri/target/` — Rust build artifacts
- `node_modules/` — Frontend dependencies (not committed)

## Data Storage

User data is stored at `~/Music/Muze/` (or vault-specific locations):

```
~/Music/Muze/
├── vault.json              # Vault registry
├── ProjectName/
│   ├── MixName/
│   │   ├── mix.json        # Mix metadata
│   │   └── audio/
│   │       ├── track_0_xxx.wav
│   │       └── track_1_xxx.wav
│   └── AnotherMix/
│       └── ...
```
