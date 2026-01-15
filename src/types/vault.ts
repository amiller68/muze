export type VaultProvider = "local" | "icloud" | "dropbox";
export type SyncStatus = "synced" | "syncing" | "error" | "offline";

export interface Vault {
  id: string;
  name: string;
  provider: VaultProvider;
  path: string;
  is_default: boolean;
  last_synced?: string;
  sync_status?: SyncStatus;
}

export interface VaultRegistry {
  version: string;
  active_vault_id: string;
  vaults: Vault[];
}

// Dropbox-specific types
export interface DropboxAuthState {
  isConnected: boolean;
  authUrl?: string;
}

export interface DropboxConfig {
  folder_path: string;
}
