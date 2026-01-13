# iCloud Container Access

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** icloud-01-entitlements

## Objective

Implement iCloud container URL access using objc2 bindings to NSFileManager.

## Implementation Steps

1. Add objc2 dependencies to `src-tauri/Cargo.toml`:
   ```toml
   [target.'cfg(target_os = "ios")'.dependencies]
   objc2 = "0.5"
   objc2-foundation = { version = "0.2", features = ["NSFileManager", "NSURL", "NSString"] }

   [target.'cfg(target_os = "macos")'.dependencies]
   objc2 = "0.5"
   objc2-foundation = { version = "0.2", features = ["NSFileManager", "NSURL", "NSString"] }
   ```

2. Create `src-tauri/src/icloud.rs`:
   ```rust
   #[cfg(any(target_os = "ios", target_os = "macos"))]
   use objc2_foundation::{NSFileManager, NSString, NSURL};

   const CONTAINER_ID: &str = "iCloud.com.krondor.muze";

   /// Check if iCloud is available on this device
   #[cfg(any(target_os = "ios", target_os = "macos"))]
   pub fn is_icloud_available() -> bool {
       unsafe {
           let file_manager = NSFileManager::defaultManager();
           let container_id = NSString::from_str(CONTAINER_ID);
           file_manager
               .URLForUbiquityContainerIdentifier(Some(&container_id))
               .is_some()
       }
   }

   #[cfg(not(any(target_os = "ios", target_os = "macos")))]
   pub fn is_icloud_available() -> bool {
       false
   }

   /// Get the URL for the iCloud container
   #[cfg(any(target_os = "ios", target_os = "macos"))]
   pub fn get_icloud_container_url() -> Option<String> {
       unsafe {
           let file_manager = NSFileManager::defaultManager();
           let container_id = NSString::from_str(CONTAINER_ID);

           file_manager
               .URLForUbiquityContainerIdentifier(Some(&container_id))
               .map(|url| url.path().map(|p| p.to_string()))
               .flatten()
       }
   }

   #[cfg(not(any(target_os = "ios", target_os = "macos")))]
   pub fn get_icloud_container_url() -> Option<String> {
       None
   }

   /// Get the Documents subdirectory within iCloud container
   pub fn get_icloud_documents_url() -> Option<String> {
       get_icloud_container_url().map(|path| format!("{}/Documents", path))
   }
   ```

3. Add module to `src-tauri/src/lib.rs`:
   ```rust
   mod icloud;
   ```

4. Add Tauri commands in `src-tauri/src/commands/mod.rs`:
   ```rust
   #[tauri::command]
   pub fn icloud_is_available() -> bool {
       icloud::is_icloud_available()
   }

   #[tauri::command]
   pub fn icloud_get_container_path() -> Option<String> {
       icloud::get_icloud_documents_url()
   }
   ```

5. Register commands in `lib.rs`

6. Add TypeScript types and service methods:
   ```typescript
   // src/services/vaultService.ts
   export async function isICloudAvailable(): Promise<boolean> {
     return invoke<boolean>("icloud_is_available");
   }

   export async function getICloudPath(): Promise<string | null> {
     return invoke<string | null>("icloud_get_container_path");
   }
   ```

## Files to Modify/Create

- `src-tauri/Cargo.toml` - Add objc2 dependencies
- `src-tauri/src/icloud.rs` - Create iCloud module
- `src-tauri/src/lib.rs` - Register module and commands
- `src-tauri/src/commands/mod.rs` - Add iCloud commands
- `src/services/vaultService.ts` - Add iCloud service methods

## Acceptance Criteria

- [ ] `is_icloud_available()` returns true when iCloud is configured
- [ ] `get_icloud_container_url()` returns valid path to container
- [ ] Documents subdirectory accessible for file operations
- [ ] Graceful fallback on non-Apple platforms (returns false/None)
- [ ] No compilation errors on iOS, macOS, or other platforms

## Verification

1. Build for iOS: `pnpm tauri ios build`
2. Install on device with iCloud enabled
3. Call `icloud_is_available` from frontend - should return true
4. Call `icloud_get_container_path` - should return path like:
   `/private/var/mobile/Library/Mobile Documents/iCloud~com~krondor~muze/Documents`
5. Create a test file at that path and verify it appears in Files app
