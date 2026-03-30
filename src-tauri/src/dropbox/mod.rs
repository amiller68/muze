//! Dropbox integration module for cloud vault storage.
//!
//! This module provides:
//! - OAuth2 PKCE authentication
//! - File sync with cursor-based incremental updates
//! - Content hashing compatible with Dropbox's algorithm

pub mod auth;
pub mod content_hash;
pub mod sync;

pub use auth::DropboxAuth;
pub use content_hash::content_hash;
pub use sync::DropboxSync;

use serde::Serialize;
use std::sync::Mutex;
use sync::{FolderEntry, SyncStatus};

/// Global auth state for storing PKCE verifier during OAuth flow
static AUTH_STATE: Mutex<Option<DropboxAuth>> = Mutex::new(None);

/// Simplified folder entry for frontend
#[derive(Debug, Clone, Serialize)]
pub struct DropboxFolderEntry {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub size: Option<u64>,
}

impl From<FolderEntry> for DropboxFolderEntry {
    fn from(entry: FolderEntry) -> Self {
        let is_folder = entry.is_folder();
        Self {
            name: entry.name,
            path: entry.path_display.unwrap_or_default(),
            is_folder,
            size: entry.size,
        }
    }
}

// =============================================================================
// Authentication Commands
// =============================================================================

/// Get the OAuth authorization URL for Dropbox login
#[tauri::command]
pub fn dropbox_get_auth_url() -> Result<String, String> {
    let mut auth = DropboxAuth::new();
    let url = auth.get_auth_url();

    // Store auth state for later code exchange
    let mut state = AUTH_STATE
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    *state = Some(auth);

    Ok(url)
}

/// Exchange OAuth authorization code for access token
#[tauri::command]
pub async fn dropbox_exchange_code(code: String) -> Result<(), String> {
    let auth = {
        let mut state = AUTH_STATE
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        state.take().ok_or("No pending auth flow")?
    };

    auth.exchange_code(&code).await?;
    Ok(())
}

/// Check if Dropbox is connected (credentials exist)
#[tauri::command]
pub fn dropbox_is_connected() -> bool {
    DropboxAuth::is_connected()
}

/// Disconnect Dropbox (clear stored credentials)
#[tauri::command]
pub fn dropbox_disconnect() -> Result<(), String> {
    DropboxAuth::disconnect()
}

// =============================================================================
// Sync Commands
// =============================================================================

/// List contents of a Dropbox folder
#[tauri::command]
pub async fn dropbox_list_folder(path: String) -> Result<Vec<DropboxFolderEntry>, String> {
    let mut sync = DropboxSync::new();
    let entries = sync.list_folder(&path).await?;
    Ok(entries.into_iter().map(Into::into).collect())
}

/// Download a file from Dropbox
#[tauri::command]
pub async fn dropbox_download_file(dropbox_path: String, local_path: String) -> Result<(), String> {
    let sync = DropboxSync::new();
    let data = sync.download(&dropbox_path).await?;

    std::fs::write(&local_path, &data).map_err(|e| format!("Write error: {}", e))?;

    Ok(())
}

/// Upload a file to Dropbox
#[tauri::command]
pub async fn dropbox_upload_file(local_path: String, dropbox_path: String) -> Result<(), String> {
    let data = std::fs::read(&local_path).map_err(|e| format!("Read error: {}", e))?;

    let mut sync = DropboxSync::new();
    sync.upload(&dropbox_path, &data).await?;

    Ok(())
}

/// Create a folder in Dropbox
#[tauri::command]
pub async fn dropbox_create_folder(path: String) -> Result<(), String> {
    let sync = DropboxSync::new();
    sync.create_folder(&path).await
}

/// Get current sync status
#[tauri::command]
pub fn dropbox_get_sync_status() -> SyncStatus {
    SyncStatus::default()
}

/// Compute content hash for a local file
#[tauri::command]
pub fn dropbox_content_hash(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    content_hash::content_hash_file(path).map_err(|e| format!("Hash error: {}", e))
}
