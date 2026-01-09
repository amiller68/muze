# Dropbox OAuth2 PKCE Flow

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** dropbox-01-sdk-setup

## Objective

Implement OAuth2 PKCE authentication flow for Dropbox, enabling secure token acquisition without a client secret.

## Implementation Steps

1. Register Dropbox app at https://www.dropbox.com/developers/apps:
   - App type: Scoped access
   - Access type: Full Dropbox (or App folder)
   - Redirect URI: `com.krondor.muze://oauth`
   - Note the App Key (client_id)

2. Implement `src-tauri/src/dropbox/auth.rs`:
   ```rust
   use dropbox_sdk::oauth2::{Authorization, PkceCode};
   use keyring::Entry;

   const APP_KEY: &str = "YOUR_APP_KEY";
   const SERVICE_NAME: &str = "com.krondor.muze.dropbox";

   pub struct DropboxAuth {
       pkce: Option<PkceCode>,
   }

   impl DropboxAuth {
       /// Generate authorization URL for user to visit
       pub fn get_auth_url(&mut self) -> String {
           let (url, pkce) = Authorization::build(APP_KEY)
               .pkce()
               .build_url();
           self.pkce = Some(pkce);
           url
       }

       /// Exchange authorization code for access token
       pub async fn exchange_code(&self, code: &str) -> Result<String, String> {
           let pkce = self.pkce.as_ref().ok_or("No PKCE code")?;
           let token = Authorization::exchange_code(APP_KEY, code, pkce)
               .await
               .map_err(|e| e.to_string())?;

           // Store refresh token securely
           Self::store_token(&token.refresh_token)?;
           Ok(token.access_token)
       }

       fn store_token(token: &str) -> Result<(), String> {
           let entry = Entry::new(SERVICE_NAME, "refresh_token")
               .map_err(|e| e.to_string())?;
           entry.set_password(token).map_err(|e| e.to_string())
       }

       pub fn get_stored_token() -> Option<String> {
           Entry::new(SERVICE_NAME, "refresh_token")
               .ok()?
               .get_password()
               .ok()
       }
   }
   ```

3. Add Tauri commands in `src-tauri/src/commands/mod.rs`:
   ```rust
   #[tauri::command]
   pub fn dropbox_get_auth_url(state: State<AppState>) -> Result<String, String> {
       // Return URL for OAuth flow
   }

   #[tauri::command]
   pub async fn dropbox_exchange_code(code: String, state: State<AppState>) -> Result<(), String> {
       // Exchange code and store token
   }

   #[tauri::command]
   pub fn dropbox_is_connected() -> bool {
       DropboxAuth::get_stored_token().is_some()
   }
   ```

4. Register commands in `lib.rs`

5. Add TypeScript types in `src/types/vault.ts`:
   ```typescript
   interface DropboxAuthState {
     isConnected: boolean;
     authUrl?: string;
   }
   ```

6. Add frontend service methods in `src/services/vaultService.ts`

## Files to Modify/Create

- `src-tauri/src/dropbox/auth.rs` - OAuth2 PKCE implementation
- `src-tauri/src/commands/mod.rs` - Add Dropbox auth commands
- `src-tauri/src/lib.rs` - Register new commands
- `src/types/vault.ts` - Add DropboxAuthState type
- `src/services/vaultService.ts` - Add auth service methods

## Acceptance Criteria

- [ ] `dropbox_get_auth_url` returns valid Dropbox OAuth URL
- [ ] `dropbox_exchange_code` successfully exchanges code for token
- [ ] Refresh token stored securely in OS keychain
- [ ] `dropbox_is_connected` correctly reports connection status
- [ ] Token refresh handled automatically when expired

## Verification

1. Call `dropbox_get_auth_url` and open the URL in browser
2. Complete Dropbox authorization
3. Capture redirect URL and extract code parameter
4. Call `dropbox_exchange_code` with the code
5. Verify `dropbox_is_connected` returns true
6. Check OS keychain for stored token (Keychain Access on macOS)
