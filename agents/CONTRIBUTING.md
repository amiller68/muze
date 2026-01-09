# Contributing to Muse

## Before You Start

```bash
make check   # Must pass before any PR
```

This runs:
- `pnpm biome check src` (TypeScript lint + format)
- `cargo clippy -- -D warnings` (Rust lint)
- `cargo fmt -- --check` (Rust format)
- `pnpm test` (Vitest)
- `cargo test` (Rust tests)

---

## Code Quality Standards

### TypeScript

```typescript
// Good: Explicit types, no any
const mix = await invoke<Mix>("load_project", { projectPath });

// Bad: Using any
const mix = await invoke<any>("load_project", { projectPath });
```

**Biome rules enforced:**
- No explicit `any` (use proper types or generics)
- No unused imports/variables
- Consistent formatting (2-space indent, double quotes)

### Rust

```rust
// Good: Handle errors explicitly
let mix = load_mix(&path).map_err(|e| e.to_string())?;

// Bad: Unwrap in production code
let mix = load_mix(&path).unwrap();
```

**Clippy rules enforced:**
- `-D warnings` - All warnings are errors
- No dead code (use `#[allow(dead_code)]` with justification)
- No unused imports

---

## Naming Conventions

### TypeScript

```typescript
// Files: camelCase.ts or PascalCase.tsx for components
mixStore.ts
MixEditor.tsx

// Types: PascalCase
interface Mix { ... }
type ViewMode = "browser" | "project" | "editor";

// Functions: camelCase
function formatTime(ms: number): string

// Constants: SCREAMING_SNAKE_CASE
const TRACK_LIMIT = 8;
```

### Rust

```rust
// Files: snake_case.rs
mod_name.rs

// Types: PascalCase
struct Mix { ... }
enum AudioCommand { ... }

// Functions: snake_case
fn load_mix(path: &str) -> Result<Mix, String>

// Constants: SCREAMING_SNAKE_CASE
const TRACK_COLORS: [&str; 8] = [...];
```

---

## Component Patterns

### SolidJS Signals

```typescript
// Local state
const [position, setPosition] = createSignal(0);

// Derived values
const currentTrack = () => mix()?.tracks[selectedTrack()];
```

### Store Pattern

```typescript
// Use the shared store for domain logic
const { currentMix, loadMix, saveMix } = useMixStore();

// Don't duplicate state - read from store
<Show when={currentMix()}>
  <MixEditor mix={currentMix()!} />
</Show>
```

### Tauri Commands

```typescript
// Wrap invoke calls in try/catch
try {
  await invoke("start_recording", { trackIndex, projectPath });
} catch (e) {
  setError(`Recording failed: ${e}`);
}
```

---

## Testing

### Frontend (Vitest)

```typescript
// src/utils/time.test.ts
describe("formatTime", () => {
  it("formats minutes correctly", () => {
    expect(formatTime(60000)).toBe("01:00.00");
  });
});
```

Run: `pnpm test` or `make test-fe`

### Backend (cargo test)

```rust
// In model.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mix_new_has_default_sample_rate() {
        let m = Mix::new("Test");
        assert_eq!(m.sample_rate, 48000);
    }
}
```

Run: `cargo test` or `make test-be`

---

## Adding a New Feature

1. **Types first**: Add types to both `src/types/` and `project/model.rs`
2. **Backend command**: Add to `commands/mod.rs`, register in `lib.rs`
3. **Frontend service**: Add invoke wrapper to `services/audioEngine.ts`
4. **Store integration**: Update `stores/mixStore.ts` if needed
5. **UI**: Update components
6. **Tests**: Add tests for new functionality
7. **`make check`**: Ensure all checks pass

---

## PR Checklist

- [ ] `make check` passes
- [ ] Types match between TS and Rust
- [ ] No `any` types without comment explaining why
- [ ] New functionality has tests
- [ ] No console.log in production code
- [ ] Auto-save pattern preserved if touching save logic
