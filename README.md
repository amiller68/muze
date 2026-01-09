# Muze

A Voice Memos-style multi-track audio recorder built with Tauri 2.0 and SolidJS. Record, layer, and mix audio tracks with a native desktop and mobile experience.

## Features

### Audio Recording
- **Multi-track recording** - Record up to 8 tracks per mix
- **Replace mode** - Record over existing audio at any position with automatic splicing
- **Live waveform visualization** - See your audio levels in real-time while recording
- **Track muting during replace** - Automatically mutes the track being replaced so you don't hear old audio

### Organization
- **Projects** - Group related mixes together
- **Collections** - Organize projects into folders
- **Spotify-style UI** - Grid view browser with visual distinction between mixes and projects
- **Search** - Filter within collections and projects

### Mix Editor
- **Three view modes**:
  - Single track view
  - Overlay view (all tracks stacked with transparency)
  - Stacked view (tracks in separate rows)
- **Transport controls** - Play, pause, skip 15s forward/back
- **Seek by click** - Click anywhere on the waveform to jump to that position
- **Zoom** - Pinch or Ctrl+scroll to zoom the timeline
- **Track settings** - Volume, mute, solo, and delete per track
- **Color-coded tracks** - Each track has a unique color

### Playback
- **Multi-track mixing** - All tracks play simultaneously with individual volume control
- **Auto-stop at end** - Playback stops when reaching the end of content
- **Position sync** - UI stays in sync with audio engine position

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri 2.0
- **Audio**: cpal (cross-platform audio), hound (WAV encoding/decoding)
- **Build**: Vite + pnpm

## Project Structure

```
muse/
├── src/                    # Frontend SolidJS app
│   ├── components/
│   │   └── editor/        # MixEditor component
│   ├── stores/            # SolidJS stores (projectStore)
│   └── App.tsx            # Main app with browser/project/editor views
├── src-tauri/             # Rust backend
│   └── src/
│       ├── audio/         # Audio engine, recorder, splice
│       ├── commands/      # Tauri commands
│       └── project/       # Project/Mix/Track models
└── package.json
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build

# Build for iOS
pnpm tauri ios build
```

## Key Implementation Details

### Audio Engine
The audio engine runs on a separate thread and handles:
- Loading WAV files into memory
- Real-time mixing of multiple tracks with volume/mute
- Recording audio input to WAV files
- Position tracking and seeking

### Splice Recording
When recording over existing audio (Replace mode):
1. Captures the playhead position when recording starts
2. Mutes the track being replaced
3. Records to a new temporary file
4. On stop, splices the new audio into the original:
   - Keeps original audio before the start position
   - Inserts the new recording
   - Keeps original audio after the recording (if any)
5. Reloads the track into the audio engine

### Waveform Visualization
- **Saved waveforms**: Generated pseudo-randomly from clip ID for consistent display
- **Live recording waveform**: Real-time input level visualization that matches saved waveform style
- **Bar density**: 10 bars per second, matching between live and saved views

## Data Storage

Mixes are stored as JSON files with accompanying audio in WAV format:
```
~/Music/Muze/
├── ProjectName/
│   ├── MixName/
│   │   ├── mix.json       # Mix metadata
│   │   └── audio/
│   │       ├── track_0_xxx.wav
│   │       └── track_1_xxx.wav
│   └── AnotherMix/
│       └── ...
```

## License

MIT
