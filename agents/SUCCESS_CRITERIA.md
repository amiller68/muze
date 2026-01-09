# Success Criteria

## Definition of Done

A change is complete when:

```bash
make check   # All checks pass
```

---

## What `make check` Runs

| Check | Command | Failures Mean |
|-------|---------|---------------|
| Biome lint | `pnpm biome check src` | TypeScript issues |
| Clippy | `cargo clippy -- -D warnings` | Rust issues |
| Rust format | `cargo fmt -- --check` | Formatting issues |
| Frontend tests | `pnpm test` | Test failures |
| Backend tests | `cargo test` | Test failures |

---

## Common Failures and Fixes

### Biome: Unused imports

```
error: This import is unused
```

**Fix**: Remove the import or use it.

### Biome: Explicit any

```
error: Unexpected any. Specify a different type.
```

**Fix**: Use the correct type:
```typescript
// Before
const mix = await invoke<any>("load_project", { projectPath });

// After
const mix = await invoke<Mix>("load_project", { projectPath });
```

### Clippy: Unused variable

```
error: unused variable: `e`
```

**Fix**: Prefix with underscore:
```rust
// Before
} catch (e) {

// After
} catch (_e) {
```

### Clippy: Dead code

```
error: function `foo` is never used
```

**Fix**: Either use it, remove it, or add `#[allow(dead_code)]` with justification.

### Format issues

```
error: Formatter would have printed different content
```

**Fix**: Run `make fmt`

---

## Type Safety Checklist

- [ ] TypeScript types in `src/types/` match Rust types in `project/model.rs`
- [ ] All `invoke()` calls have explicit return types
- [ ] No `as any` casts
- [ ] New types added to both frontend and backend

---

## Testing Requirements

### New functionality must have tests

**Frontend** (`src/**/*.test.ts`):
```typescript
describe("myFunction", () => {
  it("does the expected thing", () => {
    expect(myFunction(input)).toBe(output);
  });
});
```

**Backend** (`#[cfg(test)]` modules):
```rust
#[test]
fn my_function_works() {
    assert_eq!(my_function(input), expected);
}
```

### Test coverage expectations

- Pure functions: Should have tests
- Store actions: Test state changes
- Tauri commands: Test logic (not IPC)
- UI components: Manual testing acceptable

---

## Pre-PR Checklist

```bash
# 1. Format code
make fmt

# 2. Run all checks
make check

# 3. Manual test on device if touching:
#    - Recording
#    - Playback
#    - Export
#    - File operations
```

---

## CI Pipeline

GitHub Actions runs on every push/PR:

1. **Lint job**: Biome + Clippy
2. **Frontend tests**: Vitest
3. **Backend tests**: cargo test
4. **Build**: Full build (only if tests pass)

All jobs must pass for merge.
