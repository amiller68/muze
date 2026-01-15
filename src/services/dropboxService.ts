import { invoke } from "@tauri-apps/api/core";

// Types
export interface DropboxFolderEntry {
  name: string;
  path: string;
  is_folder: boolean;
  size?: number;
}

export interface SyncStatus {
  state: "idle" | "syncing" | "uploading" | "downloading" | "error";
  current_file?: string;
  progress?: number;
  error?: string;
}

// Authentication
export const getDropboxAuthUrl = () => invoke<string>("dropbox_get_auth_url");

export const exchangeDropboxCode = (code: string) => invoke("dropbox_exchange_code", { code });

export const isDropboxConnected = () => invoke<boolean>("dropbox_is_connected");

export const disconnectDropbox = () => invoke("dropbox_disconnect");

// Folder operations
export const listDropboxFolder = (path: string) =>
  invoke<DropboxFolderEntry[]>("dropbox_list_folder", { path });

// File operations
export const downloadDropboxFile = (dropboxPath: string, localPath: string) =>
  invoke("dropbox_download_file", { dropboxPath, localPath });

export const uploadDropboxFile = (localPath: string, dropboxPath: string) =>
  invoke("dropbox_upload_file", { localPath, dropboxPath });

export const createDropboxFolder = (path: string) => invoke("dropbox_create_folder", { path });

// Sync status
export const getDropboxSyncStatus = () => invoke<SyncStatus>("dropbox_get_sync_status");

// Content hash (for sync comparison)
export const getDropboxContentHash = (path: string) =>
  invoke<string>("dropbox_content_hash", { path });
