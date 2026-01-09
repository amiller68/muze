# Sync Status Indicators

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** dropbox-03-sync-engine, icloud-03-sync-handling

## Objective

Implement per-file and vault-level sync status indicators to show users what's synced, syncing, or pending.

## Implementation Steps

1. Define sync status types in `src/types/vault.ts`:
   ```typescript
   type FileSyncStatus = "synced" | "syncing" | "pending" | "error" | "conflict";

   interface FileSyncInfo {
     path: string;
     status: FileSyncStatus;
     progress?: number;      // 0-100 for upload/download progress
     error?: string;
     lastSynced?: string;    // ISO timestamp
   }

   type VaultSyncStatus = "synced" | "syncing" | "error" | "offline";

   interface VaultSyncInfo {
     status: VaultSyncStatus;
     lastSynced?: string;
     pendingCount: number;   // Files waiting to sync
     syncingCount: number;   // Files currently syncing
     errorCount: number;     // Files with sync errors
   }
   ```

2. Add Rust types in `src-tauri/src/vault/model.rs`:
   ```rust
   #[derive(Serialize, Deserialize, Clone)]
   #[serde(rename_all = "snake_case")]
   pub enum FileSyncStatus {
       Synced,
       Syncing,
       Pending,
       Error,
       Conflict,
   }

   #[derive(Serialize, Deserialize, Clone)]
   pub struct FileSyncInfo {
       pub path: String,
       pub status: FileSyncStatus,
       pub progress: Option<u8>,
       pub error: Option<String>,
       pub last_synced: Option<String>,
   }
   ```

3. Track sync status in sync engine:
   ```rust
   // In dropbox/sync.rs or icloud.rs
   use std::collections::HashMap;
   use std::sync::{Arc, RwLock};

   pub struct SyncTracker {
       file_status: Arc<RwLock<HashMap<String, FileSyncInfo>>>,
   }

   impl SyncTracker {
       pub fn set_syncing(&self, path: &str) {
           let mut status = self.file_status.write().unwrap();
           status.insert(path.to_string(), FileSyncInfo {
               path: path.to_string(),
               status: FileSyncStatus::Syncing,
               progress: Some(0),
               ..Default::default()
           });
       }

       pub fn set_progress(&self, path: &str, progress: u8) {
           // Update progress during upload/download
       }

       pub fn set_synced(&self, path: &str) {
           // Mark as synced with timestamp
       }

       pub fn get_vault_status(&self) -> VaultSyncInfo {
           let status = self.file_status.read().unwrap();
           VaultSyncInfo {
               status: self.compute_overall_status(&status),
               pending_count: status.values().filter(|f| f.status == FileSyncStatus::Pending).count(),
               syncing_count: status.values().filter(|f| f.status == FileSyncStatus::Syncing).count(),
               error_count: status.values().filter(|f| f.status == FileSyncStatus::Error).count(),
               last_synced: self.get_last_synced(&status),
           }
       }
   }
   ```

4. Add Tauri commands:
   ```rust
   #[tauri::command]
   pub fn get_file_sync_status(path: String) -> Option<FileSyncInfo> {
       // Return status for specific file
   }

   #[tauri::command]
   pub fn get_vault_sync_status(vault_id: String) -> VaultSyncInfo {
       // Return aggregated vault status
   }

   #[tauri::command]
   pub fn get_all_sync_status(vault_id: String) -> Vec<FileSyncInfo> {
       // Return status for all files in vault
   }
   ```

5. Create status indicator components:
   ```tsx
   // src/components/FileSyncBadge.tsx
   function FileSyncBadge(props: { status: FileSyncStatus, progress?: number }) {
     return (
       <div class={`sync-badge sync-${props.status}`}>
         <Switch>
           <Match when={props.status === "synced"}>
             <CheckIcon size={12} />
           </Match>
           <Match when={props.status === "syncing"}>
             <SpinnerIcon size={12} class="animate-spin" />
             <Show when={props.progress}>
               <span class="text-xs">{props.progress}%</span>
             </Show>
           </Match>
           <Match when={props.status === "pending"}>
             <CloudUploadIcon size={12} />
           </Match>
           <Match when={props.status === "error"}>
             <AlertIcon size={12} class="text-red-500" />
           </Match>
           <Match when={props.status === "conflict"}>
             <ConflictIcon size={12} class="text-yellow-500" />
           </Match>
         </Switch>
       </div>
     );
   }
   ```

6. Poll for status updates in MixEditor:
   ```tsx
   // Poll every 2 seconds while syncing
   createEffect(() => {
     if (vaultSyncStatus()?.status === "syncing") {
       const interval = setInterval(async () => {
         const status = await invoke<VaultSyncInfo>("get_vault_sync_status", {
           vaultId: vault().id
         });
         setVaultSyncStatus(status);
       }, 2000);

       onCleanup(() => clearInterval(interval));
     }
   });
   ```

## Files to Modify/Create

- `src/types/vault.ts` - Add sync status types
- `src-tauri/src/vault/model.rs` - Add Rust sync status types
- `src-tauri/src/vault/sync_tracker.rs` - New sync tracking module
- `src-tauri/src/commands/mod.rs` - Add status commands
- `src/components/FileSyncBadge.tsx` - New component
- `src/components/VaultSyncStatus.tsx` - New component
- `src/components/editor/MixEditor.tsx` - Show sync status

## Acceptance Criteria

- [ ] File sync status tracked during upload/download
- [ ] Progress percentage shown for large file transfers
- [ ] Vault-level status aggregates file statuses correctly
- [ ] Status updates reflected in UI within 2 seconds
- [ ] Sync badge visible on each file in mix editor
- [ ] Vault status shown in header/toolbar

## Verification

1. Open a synced vault
2. Start recording a new track
3. Verify "pending" status shown immediately after recording
4. Verify "syncing" with progress during upload
5. Verify "synced" after upload completes
6. Disconnect network and verify "offline" vault status
7. Simulate sync error and verify error indicator appears
