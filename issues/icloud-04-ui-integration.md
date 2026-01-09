# iCloud UI Integration

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** icloud-02-container-access, icloud-03-sync-handling

## Objective

Add iCloud vault option to the UI with availability detection and sync status display.

## Implementation Steps

1. Add "Use iCloud" option in Add Vault flow (`src/App.tsx`):
   ```tsx
   const [icloudAvailable, setICloudAvailable] = createSignal(false);

   onMount(async () => {
     const available = await invoke<boolean>("icloud_is_available");
     setICloudAvailable(available);
   });

   // In vault creation UI
   <Show when={icloudAvailable()}>
     <button
       class="vault-option"
       onClick={handleCreateICloudVault}
     >
       <CloudIcon />
       Use iCloud
       <span class="subtitle">Sync across Apple devices</span>
     </button>
   </Show>

   <Show when={!icloudAvailable()}>
     <div class="vault-option disabled">
       <CloudIcon />
       iCloud Unavailable
       <span class="subtitle">Sign in to iCloud in Settings</span>
     </div>
   </Show>
   ```

2. Implement iCloud vault creation:
   ```tsx
   const handleCreateICloudVault = async () => {
     const icloudPath = await invoke<string | null>("icloud_get_container_path");
     if (!icloudPath) {
       setError("iCloud not available");
       return;
     }

     const vaultName = await promptVaultName();
     if (!vaultName) return;

     await invoke("create_vault", {
       vault: {
         name: vaultName,
         provider: "icloud",
         path: `${icloudPath}/${vaultName}`,
         icloud_config: {
           container_id: "iCloud.com.krondor.muze"
         }
       }
     });

     refreshVaults();
   };
   ```

3. Add sync status indicator component:
   ```tsx
   function SyncStatusIndicator(props: { vault: Vault }) {
     return (
       <div class="sync-status">
         <Switch>
           <Match when={props.vault.sync_status === "synced"}>
             <CheckIcon class="text-green-500" />
             <span>Synced</span>
           </Match>
           <Match when={props.vault.sync_status === "syncing"}>
             <SpinnerIcon class="animate-spin" />
             <span>Syncing...</span>
           </Match>
           <Match when={props.vault.sync_status === "error"}>
             <WarningIcon class="text-red-500" />
             <span>Sync Error</span>
           </Match>
           <Match when={props.vault.sync_status === "offline"}>
             <OfflineIcon class="text-gray-500" />
             <span>Offline</span>
           </Match>
         </Switch>
         <Show when={props.vault.last_synced}>
           <span class="text-xs text-gray-400">
             {formatRelativeTime(props.vault.last_synced)}
           </span>
         </Show>
       </div>
     );
   }
   ```

4. Show download progress when opening iCloud vault on iOS:
   ```tsx
   function DownloadProgress(props: { pending: string[], total: number }) {
     const progress = () =>
       ((props.total - props.pending.length) / props.total) * 100;

     return (
       <div class="download-progress">
         <div class="progress-bar" style={{ width: `${progress()}%` }} />
         <span>Downloading {props.pending.length} files...</span>
       </div>
     );
   }
   ```

5. Handle "iCloud unavailable" gracefully:
   - Show clear message explaining how to enable
   - Link to Settings app on iOS
   - Disable iCloud option but show other providers

6. Add iCloud icon to vault list for iCloud-backed vaults

## Files to Modify/Create

- `src/App.tsx` - Add iCloud vault creation flow
- `src/components/SyncStatusIndicator.tsx` - New component
- `src/components/DownloadProgress.tsx` - New component
- `src/utils/time.ts` - Add `formatRelativeTime` helper
- `src/services/vaultService.ts` - Add vault creation method

## Acceptance Criteria

- [ ] "Use iCloud" option visible when iCloud available
- [ ] Option disabled with explanation when iCloud unavailable
- [ ] Vault created in iCloud container with correct path
- [ ] Sync status indicator shows current state
- [ ] Last synced timestamp displayed
- [ ] Download progress shown when opening vault with pending files
- [ ] iCloud icon distinguishes iCloud vaults in list

## Verification

1. On device with iCloud enabled:
   - Open Add Vault
   - Verify "Use iCloud" option is enabled
   - Create iCloud vault
   - Verify vault appears with iCloud icon

2. On device without iCloud:
   - Open Add Vault
   - Verify "Use iCloud" is disabled with explanation

3. Cross-device sync:
   - Create vault on device A
   - Add recordings
   - Open app on device B
   - Verify vault appears and files download
   - Verify sync status updates correctly

4. Offline behavior:
   - Disconnect from network
   - Verify "Offline" status shown
   - Make changes
   - Reconnect
   - Verify sync completes
