# Conflict Resolution

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** sync-01-status-indicators

## Objective

Detect sync conflicts and provide UI for users to resolve them.

## Implementation Steps

1. Define conflict types in `src/types/vault.ts`:
   ```typescript
   interface SyncConflict {
     path: string;
     localVersion: ConflictVersion;
     remoteVersion: ConflictVersion;
     conflictType: "both_modified" | "delete_modify";
   }

   interface ConflictVersion {
     modifiedAt: string;     // ISO timestamp
     modifiedBy?: string;    // Device name if available
     size: number;
     preview?: string;       // First few lines for JSON files
   }

   type ConflictResolution = "keep_local" | "keep_remote" | "keep_both";
   ```

2. Implement conflict detection in Rust:
   ```rust
   // src-tauri/src/vault/conflicts.rs
   pub struct ConflictDetector {
       vault_path: String,
   }

   impl ConflictDetector {
       /// Check for conflicts when opening vault
       pub fn detect_conflicts(&self) -> Vec<SyncConflict> {
           let mut conflicts = Vec::new();

           // Check for Dropbox conflict files (name (conflicted copy).ext)
           conflicts.extend(self.detect_dropbox_conflicts());

           // Check for iCloud conflict versions
           #[cfg(any(target_os = "ios", target_os = "macos"))]
           conflicts.extend(self.detect_icloud_conflicts());

           conflicts
       }

       fn detect_dropbox_conflicts(&self) -> Vec<SyncConflict> {
           // Look for files matching pattern: "name (conflicted copy YYYY-MM-DD).ext"
           todo!()
       }

       #[cfg(any(target_os = "ios", target_os = "macos"))]
       fn detect_icloud_conflicts(&self) -> Vec<SyncConflict> {
           // Use NSFileVersion to find conflict versions
           todo!()
       }
   }
   ```

3. Implement auto-merge for JSON files:
   ```rust
   /// Attempt to auto-merge two JSON files
   pub fn try_auto_merge(local: &str, remote: &str) -> Result<String, MergeError> {
       let local_json: serde_json::Value = serde_json::from_str(local)?;
       let remote_json: serde_json::Value = serde_json::from_str(remote)?;

       // For mix.json: use most recent modified_at
       if let (Some(local_ts), Some(remote_ts)) = (
           local_json.get("modified_at"),
           remote_json.get("modified_at")
       ) {
           if local_ts > remote_ts {
               return Ok(local.to_string());
           } else {
               return Ok(remote.to_string());
           }
       }

       Err(MergeError::CannotAutoMerge)
   }
   ```

4. Add Tauri commands:
   ```rust
   #[tauri::command]
   pub fn detect_vault_conflicts(vault_id: String) -> Vec<SyncConflict> {
       // Scan vault for conflicts
   }

   #[tauri::command]
   pub fn resolve_conflict(
       path: String,
       resolution: ConflictResolution
   ) -> Result<(), String> {
       match resolution {
           ConflictResolution::KeepLocal => {
               // Delete remote conflict file
           }
           ConflictResolution::KeepRemote => {
               // Replace local with remote
           }
           ConflictResolution::KeepBoth => {
               // Rename local to avoid conflict
           }
       }
   }

   #[tauri::command]
   pub fn get_conflict_preview(path: String) -> ConflictPreview {
       // Return preview data for both versions
   }
   ```

5. Create conflict resolution UI:
   ```tsx
   // src/components/ConflictResolutionModal.tsx
   function ConflictResolutionModal(props: {
     conflict: SyncConflict,
     onResolve: (resolution: ConflictResolution) => void
   }) {
     return (
       <Modal title="Sync Conflict Detected">
         <div class="conflict-info">
           <p class="font-medium">{props.conflict.path}</p>
           <p class="text-sm text-gray-500">
             This file was modified in multiple places
           </p>
         </div>

         <div class="versions-comparison">
           <div class="version local">
             <h4>Your Version</h4>
             <p>Modified: {formatDate(props.conflict.localVersion.modifiedAt)}</p>
             <p>Size: {formatBytes(props.conflict.localVersion.size)}</p>
             <Show when={props.conflict.localVersion.preview}>
               <pre class="preview">{props.conflict.localVersion.preview}</pre>
             </Show>
           </div>

           <div class="version remote">
             <h4>Other Version</h4>
             <p>Modified: {formatDate(props.conflict.remoteVersion.modifiedAt)}</p>
             <Show when={props.conflict.remoteVersion.modifiedBy}>
               <p>From: {props.conflict.remoteVersion.modifiedBy}</p>
             </Show>
           </div>
         </div>

         <div class="resolution-actions">
           <button onClick={() => props.onResolve("keep_local")}>
             Keep Your Version
           </button>
           <button onClick={() => props.onResolve("keep_remote")}>
             Keep Other Version
           </button>
           <button onClick={() => props.onResolve("keep_both")}>
             Keep Both
           </button>
         </div>
       </Modal>
     );
   }
   ```

6. Check for conflicts on vault open:
   ```tsx
   const openVault = async (vaultId: string) => {
     const conflicts = await invoke<SyncConflict[]>("detect_vault_conflicts", {
       vaultId
     });

     if (conflicts.length > 0) {
       setShowConflictModal(true);
       setConflicts(conflicts);
     } else {
       navigateToVault(vaultId);
     }
   };
   ```

## Files to Modify/Create

- `src/types/vault.ts` - Add conflict types
- `src-tauri/src/vault/conflicts.rs` - New conflict detection module
- `src-tauri/src/vault/mod.rs` - Export conflicts module
- `src-tauri/src/commands/mod.rs` - Add conflict commands
- `src/components/ConflictResolutionModal.tsx` - New component
- `src/App.tsx` - Add conflict check on vault open

## Acceptance Criteria

- [ ] Dropbox conflict files detected automatically
- [ ] iCloud conflict versions detected on Apple platforms
- [ ] JSON files auto-merge using modified_at timestamp
- [ ] Manual resolution UI shows both versions clearly
- [ ] "Keep local" removes remote conflict file
- [ ] "Keep remote" replaces local file
- [ ] "Keep both" renames to avoid conflict
- [ ] Conflict indicator shown in vault list

## Verification

1. Create conflict scenario:
   - Open vault on device A
   - Disconnect device A from network
   - Modify a mix on device A
   - Modify same mix on device B
   - Reconnect device A

2. Verify conflict detected on next vault open
3. Test each resolution option:
   - Keep local - verify remote changes discarded
   - Keep remote - verify local changes replaced
   - Keep both - verify both files exist with different names
4. Verify conflict indicator clears after resolution
