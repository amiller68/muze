# Dropbox SDK Setup

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** None

## Objective

Add Dropbox SDK and supporting dependencies to enable Dropbox integration.

## Implementation Steps

1. Add dependencies to `src-tauri/Cargo.toml`:
   ```toml
   [dependencies]
   dropbox-sdk = { version = "0.10", features = ["dbx_files", "default_async_client"] }
   keyring = "3"      # Secure token storage in OS keychain
   sha2 = "0.10"      # Content hash for sync comparison
   ```

2. Create module structure:
   ```
   src-tauri/src/dropbox/
   ├── mod.rs           # Public API exports
   ├── auth.rs          # OAuth2 PKCE (next ticket)
   ├── sync.rs          # Sync logic (ticket 03)
   └── content_hash.rs  # Dropbox hash algorithm (ticket 03)
   ```

3. Create initial `src-tauri/src/dropbox/mod.rs`:
   ```rust
   pub mod auth;
   pub mod sync;
   pub mod content_hash;
   ```

4. Add module to `src-tauri/src/lib.rs`:
   ```rust
   mod dropbox;
   ```

5. Run `cargo check` to verify dependencies resolve

## Files to Modify/Create

- `src-tauri/Cargo.toml` - Add dropbox-sdk, keyring, sha2 dependencies
- `src-tauri/src/dropbox/mod.rs` - Create module with submodule exports
- `src-tauri/src/dropbox/auth.rs` - Create empty placeholder
- `src-tauri/src/dropbox/sync.rs` - Create empty placeholder
- `src-tauri/src/dropbox/content_hash.rs` - Create empty placeholder
- `src-tauri/src/lib.rs` - Add `mod dropbox;`

## Acceptance Criteria

- [ ] `cargo check` passes with new dependencies
- [ ] Module structure created under `src-tauri/src/dropbox/`
- [ ] Module registered in `lib.rs`

## Verification

```bash
cd src-tauri && cargo check
```
