//! Dropbox sync engine for vault synchronization.
//!
//! Provides cursor-based incremental sync with Dropbox:
//! - List folder contents with pagination
//! - Download and upload files
//! - Large file upload via sessions (>150MB)
//! - Content hash comparison for change detection

use crate::dropbox::auth::DropboxAuth;
use crate::dropbox::content_hash;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Dropbox API endpoints
const API_URL: &str = "https://api.dropboxapi.com/2";
const CONTENT_URL: &str = "https://content.dropboxapi.com/2";

/// Maximum file size for single upload (150MB)
const MAX_SINGLE_UPLOAD_SIZE: usize = 150 * 1024 * 1024;

/// Upload session chunk size (8MB)
const UPLOAD_CHUNK_SIZE: usize = 8 * 1024 * 1024;

/// File metadata from Dropbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    #[serde(rename = ".tag")]
    pub tag: String,
    pub name: String,
    pub path_lower: Option<String>,
    pub path_display: Option<String>,
    pub id: Option<String>,
    pub client_modified: Option<String>,
    pub server_modified: Option<String>,
    pub rev: Option<String>,
    pub size: Option<u64>,
    pub content_hash: Option<String>,
}

/// Folder entry (file or folder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderEntry {
    #[serde(rename = ".tag")]
    pub tag: String,
    pub name: String,
    pub path_lower: Option<String>,
    pub path_display: Option<String>,
    pub id: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    pub content_hash: Option<String>,
}

impl FolderEntry {
    #[allow(dead_code)]
    pub fn is_file(&self) -> bool {
        self.tag == "file"
    }

    pub fn is_folder(&self) -> bool {
        self.tag == "folder"
    }
}

/// List folder response from Dropbox
#[derive(Debug, Deserialize)]
pub struct ListFolderResponse {
    pub entries: Vec<FolderEntry>,
    pub cursor: String,
    pub has_more: bool,
}

/// Sync status for tracking progress
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncState {
    Idle,
    Syncing,
    Uploading,
    Downloading,
    Error,
}

/// Sync status with details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub state: SyncState,
    pub current_file: Option<String>,
    pub progress: Option<f32>,
    pub error: Option<String>,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            state: SyncState::Idle,
            current_file: None,
            progress: None,
            error: None,
        }
    }
}

/// Dropbox sync client
pub struct DropboxSync {
    http_client: Client,
    cursor: Option<String>,
    status: SyncStatus,
}

impl DropboxSync {
    /// Create a new sync client
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
            cursor: None,
            status: SyncStatus::default(),
        }
    }

    /// Get authorization headers
    async fn get_auth_headers(&self) -> Result<HeaderMap, String> {
        let auth = DropboxAuth::new();
        let token = auth.get_valid_token().await?;

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token))
                .map_err(|e| format!("Invalid token: {}", e))?,
        );
        Ok(headers)
    }

    /// List folder contents
    pub async fn list_folder(&mut self, path: &str) -> Result<Vec<FolderEntry>, String> {
        let headers = self.get_auth_headers().await?;
        let mut all_entries = Vec::new();

        // Initial request or continue from cursor
        let response = if let Some(cursor) = &self.cursor {
            let body = serde_json::json!({ "cursor": cursor });
            self.http_client
                .post(format!("{}/files/list_folder/continue", API_URL))
                .headers(headers.clone())
                .header(CONTENT_TYPE, "application/json")
                .json(&body)
                .send()
                .await
        } else {
            let body = serde_json::json!({
                "path": if path.is_empty() { "" } else { path },
                "recursive": false,
                "include_media_info": false,
                "include_deleted": false,
            });
            self.http_client
                .post(format!("{}/files/list_folder", API_URL))
                .headers(headers.clone())
                .header(CONTENT_TYPE, "application/json")
                .json(&body)
                .send()
                .await
        };

        let response = response.map_err(|e| format!("List folder request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("List folder failed: {}", error_text));
        }

        let list_response: ListFolderResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        all_entries.extend(list_response.entries);
        self.cursor = Some(list_response.cursor);

        // Fetch remaining entries if has_more
        let mut has_more = list_response.has_more;
        while has_more {
            let cursor = self.cursor.as_ref().unwrap();
            let body = serde_json::json!({ "cursor": cursor });

            let response = self
                .http_client
                .post(format!("{}/files/list_folder/continue", API_URL))
                .headers(headers.clone())
                .header(CONTENT_TYPE, "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Continue request failed: {}", e))?;

            if !response.status().is_success() {
                break;
            }

            let list_response: ListFolderResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            all_entries.extend(list_response.entries);
            self.cursor = Some(list_response.cursor);
            has_more = list_response.has_more;
        }

        Ok(all_entries)
    }

    /// Download a file from Dropbox
    pub async fn download(&self, path: &str) -> Result<Vec<u8>, String> {
        let headers = self.get_auth_headers().await?;

        let api_arg = serde_json::json!({ "path": path });

        let response = self
            .http_client
            .post(format!("{}/files/download", CONTENT_URL))
            .headers(headers)
            .header("Dropbox-API-Arg", api_arg.to_string())
            .send()
            .await
            .map_err(|e| format!("Download request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Download failed: {}", error_text));
        }

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("Failed to read response: {}", e))
    }

    /// Upload a file to Dropbox
    pub async fn upload(&mut self, path: &str, data: &[u8]) -> Result<FileMetadata, String> {
        if data.len() > MAX_SINGLE_UPLOAD_SIZE {
            return self.upload_session(path, data).await;
        }

        let headers = self.get_auth_headers().await?;

        let api_arg = serde_json::json!({
            "path": path,
            "mode": "overwrite",
            "autorename": false,
            "mute": false,
        });

        self.status.state = SyncState::Uploading;
        self.status.current_file = Some(path.to_string());

        let response = self
            .http_client
            .post(format!("{}/files/upload", CONTENT_URL))
            .headers(headers)
            .header("Dropbox-API-Arg", api_arg.to_string())
            .header(CONTENT_TYPE, "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| format!("Upload request failed: {}", e))?;

        self.status.state = SyncState::Idle;
        self.status.current_file = None;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Upload failed: {}", error_text));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// Upload large file using upload sessions (for files >150MB)
    async fn upload_session(&mut self, path: &str, data: &[u8]) -> Result<FileMetadata, String> {
        let headers = self.get_auth_headers().await?;

        self.status.state = SyncState::Uploading;
        self.status.current_file = Some(path.to_string());

        // Start session
        let start_response = self
            .http_client
            .post(format!("{}/files/upload_session/start", CONTENT_URL))
            .headers(headers.clone())
            .header(CONTENT_TYPE, "application/octet-stream")
            .header("Dropbox-API-Arg", "{}")
            .body(Vec::new())
            .send()
            .await
            .map_err(|e| format!("Session start failed: {}", e))?;

        if !start_response.status().is_success() {
            let error_text = start_response.text().await.unwrap_or_default();
            return Err(format!("Session start failed: {}", error_text));
        }

        #[derive(Deserialize)]
        struct SessionStart {
            session_id: String,
        }
        let session: SessionStart = start_response
            .json()
            .await
            .map_err(|e| format!("Failed to parse session response: {}", e))?;

        // Upload chunks
        let total_chunks = data.len().div_ceil(UPLOAD_CHUNK_SIZE);
        let mut offset = 0usize;

        for (i, chunk) in data.chunks(UPLOAD_CHUNK_SIZE).enumerate() {
            self.status.progress = Some((i as f32 + 1.0) / total_chunks as f32);

            if offset + chunk.len() < data.len() {
                // Append chunk
                let api_arg = serde_json::json!({
                    "cursor": {
                        "session_id": session.session_id,
                        "offset": offset
                    }
                });

                let response = self
                    .http_client
                    .post(format!("{}/files/upload_session/append_v2", CONTENT_URL))
                    .headers(headers.clone())
                    .header("Dropbox-API-Arg", api_arg.to_string())
                    .header(CONTENT_TYPE, "application/octet-stream")
                    .body(chunk.to_vec())
                    .send()
                    .await
                    .map_err(|e| format!("Chunk upload failed: {}", e))?;

                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    return Err(format!("Chunk upload failed: {}", error_text));
                }
            }

            offset += chunk.len();
        }

        // Finish session
        let api_arg = serde_json::json!({
            "cursor": {
                "session_id": session.session_id,
                "offset": data.len() - data.chunks(UPLOAD_CHUNK_SIZE).last().unwrap().len()
            },
            "commit": {
                "path": path,
                "mode": "overwrite",
                "autorename": false,
                "mute": false
            }
        });

        let last_chunk = data.chunks(UPLOAD_CHUNK_SIZE).last().unwrap();
        let response = self
            .http_client
            .post(format!("{}/files/upload_session/finish", CONTENT_URL))
            .headers(headers)
            .header("Dropbox-API-Arg", api_arg.to_string())
            .header(CONTENT_TYPE, "application/octet-stream")
            .body(last_chunk.to_vec())
            .send()
            .await
            .map_err(|e| format!("Session finish failed: {}", e))?;

        self.status.state = SyncState::Idle;
        self.status.current_file = None;
        self.status.progress = None;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Session finish failed: {}", error_text));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// Check if a local file needs to be synced (content hash comparison)
    #[allow(dead_code)]
    pub fn needs_sync(&self, local_path: &Path, remote_hash: &str) -> Result<bool, String> {
        let local_hash = content_hash::content_hash_file(local_path)
            .map_err(|e| format!("Hash error: {}", e))?;

        Ok(local_hash != remote_hash)
    }

    /// Get current sync status
    #[allow(dead_code)]
    pub fn get_status(&self) -> SyncStatus {
        self.status.clone()
    }

    /// Reset cursor for fresh sync
    #[allow(dead_code)]
    pub fn reset_cursor(&mut self) {
        self.cursor = None;
    }

    /// Create a folder in Dropbox
    pub async fn create_folder(&self, path: &str) -> Result<(), String> {
        let headers = self.get_auth_headers().await?;

        let body = serde_json::json!({
            "path": path,
            "autorename": false
        });

        let response = self
            .http_client
            .post(format!("{}/files/create_folder_v2", API_URL))
            .headers(headers)
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Create folder failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            // Ignore "path/conflict/folder" error (folder already exists)
            if !error_text.contains("path/conflict") {
                return Err(format!("Create folder failed: {}", error_text));
            }
        }

        Ok(())
    }

    /// Delete a file or folder in Dropbox
    #[allow(dead_code)]
    pub async fn delete(&self, path: &str) -> Result<(), String> {
        let headers = self.get_auth_headers().await?;

        let body = serde_json::json!({ "path": path });

        let response = self
            .http_client
            .post(format!("{}/files/delete_v2", API_URL))
            .headers(headers)
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Delete failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Delete failed: {}", error_text));
        }

        Ok(())
    }
}

impl Default for DropboxSync {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_status_default() {
        let status = SyncStatus::default();
        assert_eq!(status.state, SyncState::Idle);
        assert!(status.current_file.is_none());
        assert!(status.progress.is_none());
    }

    #[test]
    fn test_folder_entry_type_detection() {
        let file = FolderEntry {
            tag: "file".to_string(),
            name: "test.txt".to_string(),
            path_lower: None,
            path_display: None,
            id: None,
            size: Some(100),
            content_hash: None,
        };
        assert!(file.is_file());
        assert!(!file.is_folder());

        let folder = FolderEntry {
            tag: "folder".to_string(),
            name: "test_folder".to_string(),
            path_lower: None,
            path_display: None,
            id: None,
            size: None,
            content_hash: None,
        };
        assert!(!folder.is_file());
        assert!(folder.is_folder());
    }
}
