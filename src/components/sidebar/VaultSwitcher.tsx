import { Show } from "solid-js";
import type { Vault } from "../../types/vault";

interface VaultSwitcherProps {
  vault: Vault | null;
  onManageVaults: () => void;
}

export function VaultSwitcher(props: VaultSwitcherProps) {
  // Sync status indicator color
  const statusColor = () => {
    const status = props.vault?.sync_status;
    switch (status) {
      case "synced":
        return "bg-green-500";
      case "syncing":
        return "bg-blue-500 animate-pulse";
      case "error":
        return "bg-red-500";
      case "offline":
        return "bg-yellow-500";
      default:
        // Local vaults with no sync status show green (always synced)
        return props.vault?.provider === "local" ? "bg-green-500" : "bg-neutral-500";
    }
  };

  // Provider icon
  const ProviderIcon = () => {
    const provider = props.vault?.provider;
    switch (provider) {
      case "icloud":
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
          </svg>
        );
      case "dropbox":
        return (
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 6.134L6 10.5l6 4.366L6 19.232l-6-4.366L6 10.5 0 6.134l6-4.366 6 4.366zm0 0l6-4.366 6 4.366-6 4.366 6 4.366-6 4.366-6-4.366 6-4.366-6-4.366z" />
          </svg>
        );
      default:
        // Local storage icon
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        );
    }
  };

  return (
    <div class="border-t border-neutral-800">
      <button
        onClick={props.onManageVaults}
        class="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-neutral-800 transition-colors text-left"
      >
        {/* Status indicator */}
        <span class={`w-2 h-2 rounded-full shrink-0 ${statusColor()}`} />

        {/* Vault name */}
        <Show when={props.vault} fallback={<span class="text-sm text-neutral-500">No vault</span>}>
          <span class="text-sm text-neutral-300 truncate flex-1">{props.vault?.name}</span>
        </Show>

        {/* Provider icon */}
        <span class="text-neutral-500 shrink-0">
          <ProviderIcon />
        </span>

        {/* Settings gear */}
        <span class="text-neutral-600 hover:text-neutral-400 shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}
