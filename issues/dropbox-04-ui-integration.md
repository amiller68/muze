# Dropbox UI Integration

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** dropbox-02-oauth-pkce, dropbox-03-sync-engine

## Objective

Add Dropbox vault creation UI including OAuth connection flow and folder picker.

## Implementation Steps

1. Add "Connect Dropbox" button to Add Vault flow in `src/App.tsx`:
   ```tsx
   const handleConnectDropbox = async () => {
     const authUrl = await invoke<string>("dropbox_get_auth_url");
     // Open in system browser or webview
     await open(authUrl);
   };
   ```

2. Handle OAuth redirect callback:
   - Register URL scheme `com.krondor.muze://oauth` in `tauri.conf.json`:
     ```json
     {
       "plugins": {
         "deep-link": {
           "desktop": {
             "schemes": ["com.krondor.muze"]
           }
         }
       }
     }
     ```
   - Listen for deep link events and extract code parameter

3. Implement Dropbox folder picker component:
   ```tsx
   function DropboxFolderPicker(props: { onSelect: (path: string) => void }) {
     const [folders, setFolders] = createSignal<FolderEntry[]>([]);
     const [currentPath, setCurrentPath] = createSignal("/");

     onMount(async () => {
       const entries = await invoke<FolderEntry[]>("dropbox_list_folder", {
         path: currentPath()
       });
       setFolders(entries.filter(e => e.is_folder));
     });

     return (
       <div class="folder-picker">
         <div class="breadcrumb">{currentPath()}</div>
         <For each={folders()}>
           {(folder) => (
             <button onClick={() => setCurrentPath(folder.path)}>
               {folder.name}
             </button>
           )}
         </For>
         <button onClick={() => props.onSelect(currentPath())}>
           Select This Folder
         </button>
       </div>
     );
   }
   ```

4. Create Dropbox vault after folder selection:
   ```tsx
   const createDropboxVault = async (name: string, folderPath: string) => {
     await invoke("create_vault", {
       vault: {
         name,
         provider: "dropbox",
         path: folderPath,
         dropbox_config: { folder_path: folderPath }
       }
     });
   };
   ```

5. Show Dropbox connection status in vault list:
   - Connected indicator
   - Last synced timestamp
   - Sync status (synced/syncing/error)

6. Add "Disconnect Dropbox" option in vault settings

## Files to Modify/Create

- `src/App.tsx` - Add Dropbox vault creation flow
- `src/components/DropboxFolderPicker.tsx` - New folder picker component
- `src-tauri/tauri.conf.json` - Register deep link scheme
- `src/services/vaultService.ts` - Add folder listing method
- `src-tauri/src/commands/mod.rs` - Add `dropbox_list_folder` command

## Acceptance Criteria

- [ ] "Connect Dropbox" button visible in Add Vault flow
- [ ] OAuth flow opens in browser/webview
- [ ] Redirect captured and code exchanged successfully
- [ ] Folder picker displays Dropbox folders
- [ ] Navigation works (enter/back)
- [ ] Vault created with correct Dropbox configuration
- [ ] Connection status visible in vault list
- [ ] "Disconnect" removes stored credentials

## Verification

1. Open Add Vault dialog
2. Click "Connect Dropbox"
3. Complete OAuth in browser
4. Verify redirect back to app
5. Browse Dropbox folders and select one
6. Create vault with name
7. Verify vault appears in list with Dropbox icon
8. Check sync status indicator updates
9. Test disconnect and reconnect flow
