# Coding Patterns

Coding patterns and conventions used in this codebase.

## Error Handling

### Rust (Backend)

- Return `Result<T, String>` from all Tauri commands
- Use simple string error messages (no custom error types)
- Log errors to stderr with `eprintln!` before returning

```rust
#[tauri::command]
pub fn some_command(arg: String) -> Result<Data, String> {
    do_something().map_err(|e| format!("Failed to do something: {}", e))
}
```

### TypeScript (Frontend)

- Use try/catch for async operations with user-visible effects
- Silent failures with `.catch(() => {})` for background operations (auto-save)
- No custom error types — handle inline

```typescript
// User-visible operation
try {
  await invoke("some_command", { arg });
} catch (e) {
  console.error("Operation failed:", e);
}

// Background operation (auto-save)
await invoke("save_project", { project }).catch(() => {});
```

## Module Organization

### Rust

- `mod.rs` declares submodules and re-exports public items
- `model.rs` contains data structures (structs, enums)
- Feature functions live in `mod.rs` or dedicated files

```
audio/
├── mod.rs          # Exports AudioEngine, configure_audio_session
├── engine.rs       # AudioEngine implementation
├── recorder.rs     # Recording and splice functions
└── ios_audio.rs    # iOS-specific audio config
```

### TypeScript

- One file per type/interface in `src/types/`
- One component per file in `src/components/`
- Barrel exports via `index.ts` for component groups
- Stores in `src/stores/` using SolidJS signals

```
components/
├── editor/
│   ├── MixEditor.tsx
│   ├── Waveform.tsx
│   └── TrackSettingsModal.tsx
└── sidebar/
    ├── Sidebar.tsx
    ├── FileTree.tsx
    └── index.ts     # Re-exports components
```

## Naming Conventions

### Rust

- `snake_case` for functions, variables, modules
- `PascalCase` for structs and enums
- `SCREAMING_SNAKE_CASE` for constants
- `_ms` suffix for millisecond values

### TypeScript

- `camelCase` for functions and variables
- `PascalCase` for types, interfaces, and components
- `SCREAMING_SNAKE_CASE` for constants
- Files: `camelCase.ts` for utilities, `PascalCase.tsx` for components

### Tauri Commands

- Backend: `snake_case` function names
- Frontend: invoke with `snake_case` command names

```rust
#[tauri::command]
pub fn get_position() -> Result<u64, String> { ... }
```

```typescript
const pos = await invoke<number>("get_position");
```

## Output Conventions

- **stderr**: Errors, warnings, and debug logs (`eprintln!`)
- **Tauri commands**: Return data via `Result<T, String>`
- **Console**: Use `console.error` for errors, `console.log` sparingly

## Testing Patterns

### Frontend (Vitest)

- Test files alongside source: `time.ts` → `time.test.ts`
- Use `describe` and `it` from Vitest
- Mock Tauri's `invoke` in `src/test/setup.ts`
- jsdom environment for component tests

```typescript
import { describe, expect, it } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("formats zero milliseconds", () => {
    expect(formatTime(0)).toBe("00:00.00");
  });
});
```

### Backend (Cargo)

- Standard `#[test]` functions or `#[cfg(test)]` modules
- Run with `cargo test` in `src-tauri/`

## Common Idioms

### SolidJS State

- Use `createSignal` for local reactive state
- Export store functions via custom hooks (`useMixStore`)
- Immutable updates: spread and create new objects

```typescript
const [mix, setMix] = createSignal<Mix | null>(null);

// Update immutably
setMix({ ...mix(), tracks: [...mix()!.tracks, newTrack] });
```

### Tauri IPC

```typescript
// Frontend: invoke backend command
const result = await invoke<ReturnType>("command_name", { arg1, arg2 });

// Backend: define command
#[tauri::command]
pub fn command_name(arg1: Type, arg2: Type) -> Result<ReturnType, String> {
    // implementation
}
```

### Auto-Save Pattern

Debounce saves to avoid excessive writes:

```typescript
let saveTimeout: number | undefined;
const autoSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = window.setTimeout(async () => {
    await invoke("save_project", { project }).catch(() => {});
  }, AUTO_SAVE_DEBOUNCE_MS);
};
```
