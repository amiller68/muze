import { invoke } from "@tauri-apps/api/core";
import type { Vault, VaultProvider, VaultRegistry } from "../types/vault";

// Registry operations
export const loadVaultRegistry = () => invoke<VaultRegistry>("load_vault_registry");

export const saveVaultRegistry = (registry: VaultRegistry) =>
  invoke("save_vault_registry", { registry });

// Vault operations
export const createVault = (name: string, provider: VaultProvider, path: string) =>
  invoke<Vault>("create_vault", { name, provider, path });

export const deleteVault = (vaultId: string) => invoke<boolean>("delete_vault", { vaultId });

export const setActiveVault = (vaultId: string) => invoke<boolean>("set_active_vault", { vaultId });

export const getActiveVaultPath = () => invoke<string>("get_active_vault_path");
