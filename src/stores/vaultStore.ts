import { createSignal } from "solid-js";
import * as vaultService from "../services/vaultService";
import type { Vault, VaultProvider } from "../types/vault";

const [vaults, setVaults] = createSignal<Vault[]>([]);
const [activeVault, setActiveVault] = createSignal<Vault | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

export function useVaultStore() {
  const loadVaults = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const registry = await vaultService.loadVaultRegistry();
      setVaults(registry.vaults);
      const active = registry.vaults.find((v) => v.id === registry.active_vault_id) || null;
      setActiveVault(active);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const createVault = async (name: string, provider: VaultProvider, path: string) => {
    setError(null);
    try {
      const vault = await vaultService.createVault(name, provider, path);
      setVaults([...vaults(), vault]);
      return vault;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  const deleteVault = async (vaultId: string) => {
    setError(null);
    try {
      const removed = await vaultService.deleteVault(vaultId);
      if (removed) {
        setVaults(vaults().filter((v) => v.id !== vaultId));
      }
      return removed;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  const switchVault = async (vaultId: string) => {
    setError(null);
    try {
      const success = await vaultService.setActiveVault(vaultId);
      if (success) {
        const vault = vaults().find((v) => v.id === vaultId) || null;
        setActiveVault(vault);
      }
      return success;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  const getActiveVaultPath = async () => {
    try {
      return await vaultService.getActiveVaultPath();
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  return {
    // State
    vaults,
    activeVault,
    isLoading,
    error,
    // Actions
    loadVaults,
    createVault,
    deleteVault,
    switchVault,
    getActiveVaultPath,
  };
}
