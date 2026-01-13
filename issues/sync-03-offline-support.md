# Offline Support

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** sync-01-status-indicators, sync-02-conflict-resolution

## Objective

Queue changes when offline and sync when connection is restored, with clear offline mode indication.

## Implementation Steps

1. Define offline queue types in `src/types/vault.ts`:
   ```typescript
   type OfflineAction = "create" | "update" | "delete";

   interface QueuedChange {
     id: string;
     action: OfflineAction;
     path: string;
     timestamp: string;
     data?: string;  // For creates/updates, the file content or path
   }

   interface OfflineState {
     isOffline: boolean;
     queuedChanges: QueuedChange[];
     lastOnline?: string;
   }
   ```

2. Implement offline queue in Rust:
   ```rust
   // src-tauri/src/vault/offline_queue.rs
   use std::collections::VecDeque;
   use std::sync::{Arc, RwLock};

   pub struct OfflineQueue {
       queue: Arc<RwLock<VecDeque<QueuedChange>>>,
       queue_file: PathBuf,  // Persist queue to disk
   }

   impl OfflineQueue {
       pub fn new(vault_path: &Path) -> Self {
           let queue_file = vault_path.join(".sync_queue.json");
           let queue = Self::load_from_disk(&queue_file);
           Self { queue: Arc::new(RwLock::new(queue)), queue_file }
       }

       pub fn enqueue(&self, change: QueuedChange) {
           let mut queue = self.queue.write().unwrap();
           queue.push_back(change);
           self.persist_to_disk();
       }

       pub fn dequeue(&self) -> Option<QueuedChange> {
           let mut queue = self.queue.write().unwrap();
           let change = queue.pop_front();
           self.persist_to_disk();
           change
       }

       pub fn peek_all(&self) -> Vec<QueuedChange> {
           self.queue.read().unwrap().iter().cloned().collect()
       }

       fn persist_to_disk(&self) {
           // Save queue to .sync_queue.json for crash recovery
       }

       fn load_from_disk(path: &Path) -> VecDeque<QueuedChange> {
           // Load persisted queue on startup
       }
   }
   ```

3. Implement network connectivity detection:
   ```rust
   // src-tauri/src/vault/connectivity.rs
   use std::time::Duration;

   pub async fn is_online() -> bool {
       // Try to reach a reliable endpoint
       let timeout = Duration::from_secs(5);
       tokio::time::timeout(timeout, async {
           reqwest::get("https://www.dropbox.com/").await.is_ok()
       })
       .await
       .unwrap_or(false)
   }

   pub fn start_connectivity_monitor(
       on_online: impl Fn() + Send + 'static,
       on_offline: impl Fn() + Send + 'static
   ) -> tokio::task::JoinHandle<()> {
       tokio::spawn(async move {
           let mut was_online = true;
           loop {
               let online = is_online().await;
               if online && !was_online {
                   on_online();
               } else if !online && was_online {
                   on_offline();
               }
               was_online = online;
               tokio::time::sleep(Duration::from_secs(10)).await;
           }
       })
   }
   ```

4. Add automatic sync on reconnection:
   ```rust
   impl DropboxSync {
       pub async fn process_offline_queue(&self, queue: &OfflineQueue) -> Result<(), String> {
           while let Some(change) = queue.peek_all().first() {
               match change.action {
                   OfflineAction::Create | OfflineAction::Update => {
                       self.upload(&change.path, &change.data.unwrap()).await?;
                   }
                   OfflineAction::Delete => {
                       self.delete(&change.path).await?;
                   }
               }
               queue.dequeue();
           }
           Ok(())
       }
   }
   ```

5. Add Tauri commands:
   ```rust
   #[tauri::command]
   pub async fn check_connectivity() -> bool {
       connectivity::is_online().await
   }

   #[tauri::command]
   pub fn get_queued_changes(vault_id: String) -> Vec<QueuedChange> {
       // Return pending changes for display
   }

   #[tauri::command]
   pub async fn force_sync(vault_id: String) -> Result<SyncResult, String> {
       // Manually trigger sync attempt
   }
   ```

6. Create offline UI indicators:
   ```tsx
   // src/components/OfflineBanner.tsx
   function OfflineBanner() {
     const [isOffline, setIsOffline] = createSignal(false);
     const [queuedCount, setQueuedCount] = createSignal(0);

     onMount(() => {
       // Listen for connectivity changes from backend
       listen("connectivity_changed", (event) => {
         setIsOffline(!event.payload.online);
       });
     });

     return (
       <Show when={isOffline()}>
         <div class="offline-banner bg-yellow-100 text-yellow-800 p-2 text-center">
           <WifiOffIcon class="inline mr-2" />
           <span>You're offline. </span>
           <Show when={queuedCount() > 0}>
             <span>{queuedCount()} changes will sync when connected.</span>
           </Show>
         </div>
       </Show>
     );
   }
   ```

7. Show queued changes in vault detail:
   ```tsx
   function QueuedChangesPanel(props: { changes: QueuedChange[] }) {
     return (
       <div class="queued-changes">
         <h4>Pending Changes ({props.changes.length})</h4>
         <For each={props.changes}>
           {(change) => (
             <div class="change-item">
               <span class={`action-${change.action}`}>
                 {change.action.toUpperCase()}
               </span>
               <span class="path">{change.path}</span>
               <span class="time">{formatRelativeTime(change.timestamp)}</span>
             </div>
           )}
         </For>
       </div>
     );
   }
   ```

8. Add "Sync Now" button for manual sync attempts:
   ```tsx
   function SyncNowButton(props: { vaultId: string }) {
     const [syncing, setSyncing] = createSignal(false);

     const handleSync = async () => {
       setSyncing(true);
       try {
         await invoke("force_sync", { vaultId: props.vaultId });
       } catch (e) {
         setError(`Sync failed: ${e}`);
       } finally {
         setSyncing(false);
       }
     };

     return (
       <button onClick={handleSync} disabled={syncing()}>
         {syncing() ? <SpinnerIcon /> : <SyncIcon />}
         {syncing() ? "Syncing..." : "Sync Now"}
       </button>
     );
   }
   ```

## Files to Modify/Create

- `src/types/vault.ts` - Add offline/queue types
- `src-tauri/src/vault/offline_queue.rs` - New queue module
- `src-tauri/src/vault/connectivity.rs` - New connectivity module
- `src-tauri/src/vault/mod.rs` - Export new modules
- `src-tauri/src/commands/mod.rs` - Add offline commands
- `src/components/OfflineBanner.tsx` - New component
- `src/components/QueuedChangesPanel.tsx` - New component
- `src/components/SyncNowButton.tsx` - New component
- `src/App.tsx` - Add offline banner to layout

## Acceptance Criteria

- [ ] Changes queued when offline instead of failing
- [ ] Queue persisted to disk (survives app restart)
- [ ] Connectivity monitored continuously
- [ ] Automatic sync triggered on reconnection
- [ ] Offline banner visible when disconnected
- [ ] Queued change count displayed
- [ ] "Sync Now" button triggers manual sync
- [ ] Queued changes panel shows pending operations

## Verification

1. Disconnect from network
2. Make changes (record track, rename mix, etc.)
3. Verify offline banner appears
4. Verify changes queued (check count in UI)
5. Close and reopen app
6. Verify queue persisted
7. Reconnect to network
8. Verify automatic sync starts
9. Verify all queued changes synced successfully
10. Verify offline banner disappears
