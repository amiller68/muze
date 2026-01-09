# Dropbox Sync Engine

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** dropbox-02-oauth-pkce

## Objective

Implement the sync engine for Dropbox vaults using cursor-based incremental sync and content hashing.

## Implementation Steps

1. Implement Dropbox content hash in `src-tauri/src/dropbox/content_hash.rs`:
   ```rust
   use sha2::{Sha256, Digest};

   const BLOCK_SIZE: usize = 4 * 1024 * 1024; // 4MB blocks

   /// Compute Dropbox's content hash for a file
   pub fn content_hash(data: &[u8]) -> String {
       let mut block_hashes = Vec::new();

       for chunk in data.chunks(BLOCK_SIZE) {
           let mut hasher = Sha256::new();
           hasher.update(chunk);
           block_hashes.extend_from_slice(&hasher.finalize());
       }

       let mut final_hasher = Sha256::new();
       final_hasher.update(&block_hashes);
       hex::encode(final_hasher.finalize())
   }
   ```

2. Implement sync logic in `src-tauri/src/dropbox/sync.rs`:
   ```rust
   use dropbox_sdk::files;

   pub struct DropboxSync {
       client: dropbox_sdk::UserAuthDefaultClient,
       cursor: Option<String>,
   }

   impl DropboxSync {
       /// List folder with cursor for incremental sync
       pub async fn list_folder(&mut self, path: &str) -> Result<Vec<FileEntry>, String> {
           let result = if let Some(cursor) = &self.cursor {
               files::list_folder_continue(&self.client, cursor).await
           } else {
               files::list_folder(&self.client, path).await
           };

           let response = result.map_err(|e| e.to_string())?;
           self.cursor = Some(response.cursor);

           // Convert to our FileEntry type
           Ok(response.entries.into_iter().map(Into::into).collect())
       }

       /// Download a file
       pub async fn download(&self, path: &str) -> Result<Vec<u8>, String> {
           files::download(&self.client, path, ..)
               .await
               .map_err(|e| e.to_string())
       }

       /// Upload a file (with chunked upload for large files)
       pub async fn upload(&self, path: &str, data: &[u8]) -> Result<(), String> {
           if data.len() > 150_000_000 {
               self.upload_session(path, data).await
           } else {
               files::upload(&self.client, path, data)
                   .await
                   .map_err(|e| e.to_string())?;
               Ok(())
           }
       }

       /// Upload large files using upload sessions
       async fn upload_session(&self, path: &str, data: &[u8]) -> Result<(), String> {
           // Implement chunked upload for WAV files > 150MB
           todo!("Implement upload session")
       }
   }
   ```

3. Implement selective sync strategy:
   - JSON files: Sync immediately (small, critical)
   - WAV files: Background upload after recording, on-demand download

4. Add background sync worker using tokio:
   ```rust
   pub fn start_sync_worker(vault_path: &str) -> tokio::task::JoinHandle<()> {
       tokio::spawn(async move {
           loop {
               // Poll for changes every 30 seconds
               tokio::time::sleep(Duration::from_secs(30)).await;
               // Sync changes
           }
       })
   }
   ```

5. Add Tauri commands:
   - `dropbox_sync_vault` - Trigger manual sync
   - `dropbox_download_file` - Download specific file
   - `dropbox_get_sync_status` - Get current sync state

## Files to Modify/Create

- `src-tauri/src/dropbox/content_hash.rs` - Dropbox hash algorithm
- `src-tauri/src/dropbox/sync.rs` - Sync engine implementation
- `src-tauri/src/commands/mod.rs` - Add sync commands
- `src-tauri/src/lib.rs` - Register commands
- `src-tauri/Cargo.toml` - Add hex dependency for hash encoding

## Acceptance Criteria

- [ ] Content hash matches Dropbox's algorithm for test files
- [ ] `list_folder` returns file entries with cursors for incremental sync
- [ ] Files under 150MB upload successfully
- [ ] Large files (>150MB) upload via session API
- [ ] Download retrieves correct file content
- [ ] Background sync worker runs without blocking UI

## Verification

1. Create a test vault with Dropbox provider
2. Add a mix with recordings
3. Verify files appear in Dropbox web interface
4. Modify a file in Dropbox web
5. Trigger sync and verify local file updates
6. Test with a large WAV file (>150MB) to verify chunked upload
