# iCloud Sync Handling

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** icloud-02-container-access

## Objective

Handle platform-specific iCloud sync behavior: automatic on macOS, explicit downloads on iOS.

## Implementation Steps

1. Add download trigger for iOS in `src-tauri/src/icloud.rs`:
   ```rust
   #[cfg(target_os = "ios")]
   use objc2_foundation::NSFileManager;

   /// Trigger download of a file from iCloud (iOS only)
   /// On macOS, files sync automatically
   #[cfg(target_os = "ios")]
   pub fn start_downloading_file(path: &str) -> Result<(), String> {
       unsafe {
           let file_manager = NSFileManager::defaultManager();
           let url = NSURL::fileURLWithPath(&NSString::from_str(path));

           file_manager
               .startDownloadingUbiquitousItemAtURL(&url)
               .map_err(|e| e.to_string())
       }
   }

   #[cfg(not(target_os = "ios"))]
   pub fn start_downloading_file(_path: &str) -> Result<(), String> {
       // No-op on macOS - files download automatically
       Ok(())
   }
   ```

2. Check file download status:
   ```rust
   /// Check if a file is downloaded locally or still in cloud
   pub fn is_file_downloaded(path: &str) -> bool {
       // Check for .icloud placeholder file
       let icloud_path = format!(".{}.icloud", path);
       !std::path::Path::new(&icloud_path).exists()
   }

   /// Get list of files that need downloading
   pub fn get_pending_downloads(dir: &str) -> Vec<String> {
       std::fs::read_dir(dir)
           .ok()
           .map(|entries| {
               entries
                   .filter_map(|e| e.ok())
                   .filter(|e| e.file_name().to_string_lossy().starts_with('.'))
                   .filter(|e| e.file_name().to_string_lossy().ends_with(".icloud"))
                   .map(|e| {
                       // Convert .filename.icloud back to filename
                       let name = e.file_name().to_string_lossy().to_string();
                       name[1..name.len()-7].to_string()
                   })
                   .collect()
           })
           .unwrap_or_default()
   }
   ```

3. Handle conflict detection using NSFileVersion:
   ```rust
   /// Get conflict versions for a file
   #[cfg(any(target_os = "ios", target_os = "macos"))]
   pub fn get_conflict_versions(path: &str) -> Vec<ConflictVersion> {
       // Use NSFileVersion API to detect conflicts
       // Return list of conflicting versions with metadata
       todo!("Implement NSFileVersion bindings")
   }

   pub struct ConflictVersion {
       pub path: String,
       pub modified_date: String,
       pub device_name: Option<String>,
   }
   ```

4. Add Tauri commands:
   ```rust
   #[tauri::command]
   pub fn icloud_download_file(path: String) -> Result<(), String> {
       icloud::start_downloading_file(&path)
   }

   #[tauri::command]
   pub fn icloud_is_downloaded(path: String) -> bool {
       icloud::is_file_downloaded(&path)
   }

   #[tauri::command]
   pub fn icloud_pending_downloads(dir: String) -> Vec<String> {
       icloud::get_pending_downloads(&dir)
   }
   ```

5. Create sync status polling on frontend:
   ```typescript
   // Poll for download status when opening iCloud vault
   async function ensureFilesDownloaded(vaultPath: string) {
     const pending = await invoke<string[]>("icloud_pending_downloads", {
       dir: vaultPath
     });

     for (const file of pending) {
       await invoke("icloud_download_file", { path: `${vaultPath}/${file}` });
     }

     // Poll until all downloaded
     while (pending.length > 0) {
       await sleep(1000);
       pending = await invoke<string[]>("icloud_pending_downloads", {
         dir: vaultPath
       });
     }
   }
   ```

## Files to Modify/Create

- `src-tauri/src/icloud.rs` - Add download triggers and status checks
- `src-tauri/src/commands/mod.rs` - Add sync handling commands
- `src-tauri/src/lib.rs` - Register new commands
- `src/services/vaultService.ts` - Add sync status methods

## Acceptance Criteria

- [ ] `start_downloading_file` triggers download on iOS
- [ ] `is_file_downloaded` correctly detects .icloud placeholders
- [ ] `get_pending_downloads` lists all cloud-only files
- [ ] macOS automatically syncs without explicit calls
- [ ] Conflict versions detected when files modified on multiple devices

## Verification

1. Create iCloud vault on macOS
2. Add recordings to the vault
3. Open same vault on iOS device
4. Verify files show as pending download initially
5. Call download triggers
6. Verify files become available locally
7. Test conflict: edit same mix on both devices while offline
8. Reconnect and verify conflict detected
