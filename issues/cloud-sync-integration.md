# Cloud Storage Integration for Muze

## Status: Planned (Phase 1 Complete)

Phase 1 (Vault Architecture) has been implemented. Phases 2-4 remain.

---

## Product Concept: Vaults

A **Vault** is a top-level container backed by a configurable storage provider. This allows users to:
- Have multiple vaults (e.g., "Personal" on iCloud, "Work" on Dropbox, "Local Backup")
- Switch between vaults in the app
- Each vault contains its own Collections > Projects > Mixes hierarchy

### Vault Configuration Model

```typescript
interface Vault {
  id: string;
  name: string;
  provider: "local" | "icloud" | "dropbox";
  path: string;              // Root path for this vault
  is_default: boolean;
  last_synced?: string;      // ISO timestamp
  sync_status?: "synced" | "syncing" | "error" | "offline";

  // Provider-specific config
  dropbox_config?: {
    folder_path: string;     // e.g., "/Apps/Muze/MyVault"
  };
  icloud_config?: {
    container_id: string;    // e.g., "iCloud.com.krondor.muze"
  };
}
```

---

## Implementation Phases

### Phase 1: Vault Architecture Foundation ✅ COMPLETE

- Types (TS + Rust) - `src/types/vault.ts`, `src-tauri/src/vault/model.rs`
- Backend commands - `src-tauri/src/vault/mod.rs`
- Frontend service - `src/services/vaultService.ts`
- Store - `src/stores/vaultStore.ts`
- Basic UI integration

---

### Phase 2: Dropbox Integration

**Goal**: First-class Dropbox support as a vault provider

**Tickets:**
- [dropbox-01-sdk-setup.md](./dropbox-01-sdk-setup.md) - Add SDK dependencies
- [dropbox-02-oauth-pkce.md](./dropbox-02-oauth-pkce.md) - Implement OAuth2 PKCE flow
- [dropbox-03-sync-engine.md](./dropbox-03-sync-engine.md) - Sync engine with cursors
- [dropbox-04-ui-integration.md](./dropbox-04-ui-integration.md) - UI integration

1. **Add Dropbox SDK**
   ```toml
   dropbox-sdk = { version = "0.10", features = ["dbx_files", "default_async_client"] }
   keyring = "3"  # Secure token storage
   sha2 = "0.10"  # Content hash for sync
   ```

2. **Implement OAuth2 PKCE flow**
   - `dropbox_authorize()` - returns auth URL
   - `dropbox_exchange_code()` - exchange code for tokens
   - Store refresh token in keychain via `keyring` crate
   - Handle token refresh automatically

3. **Implement sync engine**
   - Background sync worker using Dropbox's list_folder + cursor for incremental sync
   - Content hash comparison (Dropbox's algorithm) to detect changes
   - Selective sync: JSON files sync immediately, WAV files sync on-demand
   - Upload session support for large WAV files (>150MB)

4. **Add Dropbox vault type to UI**
   - "Connect Dropbox" button in Add Vault flow
   - OAuth webview/browser redirect
   - Folder picker within Dropbox

**New files:**
- `src-tauri/src/dropbox/mod.rs` - public API
- `src-tauri/src/dropbox/auth.rs` - OAuth2 PKCE
- `src-tauri/src/dropbox/sync.rs` - sync logic
- `src-tauri/src/dropbox/content_hash.rs` - Dropbox hash algorithm

**Critical implementation details:**
- Use PKCE (no client secret needed for mobile/desktop)
- Register URL scheme `com.krondor.muze://oauth` for redirect
- Sync strategy: JSON immediately, WAV on-demand with background upload after recording

---

### Phase 3: iCloud Integration

**Goal**: Native Apple sync for seamless cross-device experience

**Tickets:**
- [icloud-01-entitlements.md](./icloud-01-entitlements.md) - Configure entitlements and Info.plist
- [icloud-02-container-access.md](./icloud-02-container-access.md) - iCloud container access via objc2
- [icloud-03-sync-handling.md](./icloud-03-sync-handling.md) - Platform-specific sync handling
- [icloud-04-ui-integration.md](./icloud-04-ui-integration.md) - UI integration

1. **Configure entitlements**
   - Add to `muze_iOS.entitlements`:
     - `com.apple.developer.icloud-services`: `["CloudDocuments"]`
     - `com.apple.developer.icloud-container-identifiers`: `["iCloud.com.krondor.muze"]`
   - Add `NSUbiquitousContainers` to `Info.plist` for Files app visibility

2. **Implement iCloud container access**
   - Add `NSFileManager` feature to `objc2-foundation`
   - `get_icloud_container_url()` via objc2 bindings
   - `is_icloud_available()` check
   - `start_downloading_file()` for iOS on-demand download

3. **Handle sync specifics**
   - macOS: Automatic sync (system handles it)
   - iOS: Trigger downloads explicitly via `startDownloadingUbiquitousItemAtURL`
   - Conflict resolution using `NSFileVersion` API

4. **Add iCloud vault type to UI**
   - "Use iCloud" option in Add Vault flow
   - Show sync status indicator
   - Handle "iCloud unavailable" gracefully

**Files to modify:**
- `src-tauri/gen/apple/muze_iOS/muze_iOS.entitlements`
- `src-tauri/gen/apple/muze_iOS/Info.plist`
- `src-tauri/Cargo.toml` - add NSFileManager feature
- New: `src-tauri/src/icloud.rs`

---

### Phase 4: Sync Status & Polish

**Tickets:**
- [sync-01-status-indicators.md](./sync-01-status-indicators.md) - Per-file and vault sync status
- [sync-02-conflict-resolution.md](./sync-02-conflict-resolution.md) - Conflict detection and resolution UI
- [sync-03-offline-support.md](./sync-03-offline-support.md) - Offline queue and sync restoration

1. **Sync status indicators**
   - Per-file sync status (synced, syncing, pending, conflict)
   - Vault-level sync status in UI
   - Background sync progress

2. **Conflict resolution UI**
   - Detect conflicts on vault open
   - For JSON: auto-merge when possible (compare modified_at)
   - For conflicts that can't auto-merge: show diff and let user choose

3. **Offline support**
   - Queue changes when offline
   - Sync when connection restored
   - Clear indication of offline mode

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync granularity | Per-file | WAV files are large; avoid re-uploading entire projects |
| Conflict strategy | Auto-merge JSON, last-write-wins WAV | JSON has structure to merge; WAV rarely conflicts |
| Token storage | OS keychain | Secure, survives app updates |
| iCloud approach | Ubiquity container | Automatic sync, Files app visible |
| Dropbox sync | Cursor-based incremental | Efficient, handles large libraries |

---

## Verification Checklist

### Phase 2 (Dropbox)
- [ ] Connect Dropbox account via OAuth flow
- [ ] Create Dropbox-backed vault → folder created in Dropbox
- [ ] Record a track → verify it uploads (check Dropbox web)
- [ ] Second device: open same vault → verify files download
- [ ] Test offline: record → go offline → reconnect → verify sync completes
- [ ] Conflict test: edit same project offline on two devices → verify resolution

### Phase 3 (iCloud)
- [ ] Enable iCloud on test device with valid Apple ID
- [ ] Create iCloud-backed vault
- [ ] Record on iOS → appears on macOS (or vice versa)
- [ ] Files app shows Muze folder under iCloud Drive
- [ ] Delete from one device → propagates to other
- [ ] Conflict: edit same mix on two devices offline, reconnect → resolution works
