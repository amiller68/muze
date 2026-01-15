import { createSignal } from "solid-js";
import type { DropboxFolderEntry, SyncStatus } from "../services/dropboxService";
import * as dropboxService from "../services/dropboxService";

// Module-level signals (private state)
const [isConnected, setIsConnected] = createSignal(false);
const [isAuthenticating, setIsAuthenticating] = createSignal(false);
const [authUrl, setAuthUrl] = createSignal<string | null>(null);
const [syncStatus, setSyncStatus] = createSignal<SyncStatus>({ state: "idle" });
const [currentFolder, setCurrentFolder] = createSignal<DropboxFolderEntry[]>([]);
const [currentPath, setCurrentPath] = createSignal("");
const [isLoadingFolder, setIsLoadingFolder] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

export function useDropboxStore() {
  /**
   * Check if Dropbox is connected (credentials exist)
   */
  const checkConnection = async () => {
    setError(null);
    try {
      const connected = await dropboxService.isDropboxConnected();
      setIsConnected(connected);
      return connected;
    } catch (e) {
      setError(String(e));
      setIsConnected(false);
      return false;
    }
  };

  /**
   * Start the OAuth flow - get auth URL
   */
  const startAuth = async () => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const url = await dropboxService.getDropboxAuthUrl();
      setAuthUrl(url);
      return url;
    } catch (e) {
      setError(String(e));
      setIsAuthenticating(false);
      throw e;
    }
  };

  /**
   * Complete the OAuth flow - exchange code for token
   */
  const completeAuth = async (code: string) => {
    setError(null);
    try {
      await dropboxService.exchangeDropboxCode(code);
      setIsConnected(true);
      setAuthUrl(null);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsAuthenticating(false);
    }
  };

  /**
   * Cancel the OAuth flow
   */
  const cancelAuth = () => {
    setIsAuthenticating(false);
    setAuthUrl(null);
  };

  /**
   * Disconnect Dropbox (clear credentials)
   */
  const disconnect = async () => {
    setError(null);
    try {
      await dropboxService.disconnectDropbox();
      setIsConnected(false);
      setCurrentFolder([]);
      setCurrentPath("");
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  /**
   * List folder contents
   */
  const listFolder = async (path: string) => {
    setError(null);
    setIsLoadingFolder(true);
    try {
      const entries = await dropboxService.listDropboxFolder(path);
      setCurrentFolder(entries);
      setCurrentPath(path);
      return entries;
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setIsLoadingFolder(false);
    }
  };

  /**
   * Navigate to a subfolder
   */
  const navigateToFolder = async (path: string) => {
    return listFolder(path);
  };

  /**
   * Navigate up one level
   */
  const navigateUp = async () => {
    const current = currentPath();
    if (!current || current === "/") return;

    const parentPath = current.split("/").slice(0, -1).join("/") || "";
    return listFolder(parentPath);
  };

  /**
   * Create a new folder
   */
  const createFolder = async (path: string) => {
    setError(null);
    try {
      await dropboxService.createDropboxFolder(path);
      // Refresh current folder view
      await listFolder(currentPath());
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  /**
   * Get sync status
   */
  const refreshSyncStatus = async () => {
    try {
      const status = await dropboxService.getDropboxSyncStatus();
      setSyncStatus(status);
      return status;
    } catch (e) {
      setError(String(e));
      throw e;
    }
  };

  return {
    // State
    isConnected,
    isAuthenticating,
    authUrl,
    syncStatus,
    currentFolder,
    currentPath,
    isLoadingFolder,
    error,
    // Actions
    checkConnection,
    startAuth,
    completeAuth,
    cancelAuth,
    disconnect,
    listFolder,
    navigateToFolder,
    navigateUp,
    createFolder,
    refreshSyncStatus,
  };
}
