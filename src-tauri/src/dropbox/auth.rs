//! OAuth2 PKCE authentication for Dropbox.
//!
//! Uses PKCE (Proof Key for Code Exchange) for secure authentication
//! without requiring a client secret, suitable for mobile/desktop apps.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use keyring::Entry;
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Dropbox App Key - must be configured with your registered app
const APP_KEY: &str = "YOUR_DROPBOX_APP_KEY"; // TODO: Replace with actual app key

/// Keychain service identifier
const SERVICE_NAME: &str = "com.krondor.muze.dropbox";

/// OAuth2 endpoints
const AUTH_URL: &str = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL: &str = "https://api.dropboxapi.com/oauth2/token";

/// Redirect URI for OAuth callback
const REDIRECT_URI: &str = "com.krondor.muze://oauth";

/// Token response from Dropbox OAuth2
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub uid: Option<String>,
    pub account_id: Option<String>,
}

/// Stored credentials in keychain
#[derive(Debug, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub account_id: Option<String>,
}

/// Dropbox authentication handler with PKCE support
pub struct DropboxAuth {
    /// PKCE code verifier (stored temporarily during auth flow)
    code_verifier: Option<String>,
    http_client: Client,
}

impl DropboxAuth {
    /// Create a new authentication handler
    pub fn new() -> Self {
        Self {
            code_verifier: None,
            http_client: Client::new(),
        }
    }

    /// Generate a cryptographically random code verifier for PKCE
    fn generate_code_verifier() -> String {
        let mut rng = rand::thread_rng();
        let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        URL_SAFE_NO_PAD.encode(&bytes)
    }

    /// Generate code challenge from verifier (S256 method)
    fn generate_code_challenge(verifier: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let hash = hasher.finalize();
        URL_SAFE_NO_PAD.encode(hash)
    }

    /// Generate the authorization URL for user to visit
    ///
    /// Returns the URL and stores the PKCE verifier internally
    pub fn get_auth_url(&mut self) -> String {
        let verifier = Self::generate_code_verifier();
        let challenge = Self::generate_code_challenge(&verifier);
        self.code_verifier = Some(verifier);

        let params = [
            ("client_id", APP_KEY),
            ("response_type", "code"),
            ("redirect_uri", REDIRECT_URI),
            ("code_challenge", &challenge),
            ("code_challenge_method", "S256"),
            ("token_access_type", "offline"), // Request refresh token
        ];

        let url = url::Url::parse_with_params(AUTH_URL, &params).expect("Failed to build auth URL");
        url.to_string()
    }

    /// Exchange authorization code for access token
    ///
    /// This should be called after the user completes the OAuth flow
    /// and is redirected back with an authorization code.
    pub async fn exchange_code(&self, code: &str) -> Result<TokenResponse, String> {
        let verifier = self
            .code_verifier
            .as_ref()
            .ok_or("No PKCE verifier found - call get_auth_url first")?;

        let params = [
            ("code", code),
            ("grant_type", "authorization_code"),
            ("client_id", APP_KEY),
            ("redirect_uri", REDIRECT_URI),
            ("code_verifier", verifier),
        ];

        let response = self
            .http_client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Token request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Token exchange failed: {}", error_text));
        }

        let token: TokenResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        // Store credentials in keychain
        let creds = StoredCredentials {
            access_token: token.access_token.clone(),
            refresh_token: token.refresh_token.clone(),
            account_id: token.account_id.clone(),
        };
        Self::store_credentials(&creds)?;

        Ok(token)
    }

    /// Refresh an expired access token
    #[allow(dead_code)]
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TokenResponse, String> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", APP_KEY),
        ];

        let response = self
            .http_client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Token refresh failed: {}", error_text));
        }

        let token: TokenResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        // Update stored credentials
        let creds = StoredCredentials {
            access_token: token.access_token.clone(),
            refresh_token: token
                .refresh_token
                .clone()
                .or_else(|| Some(refresh_token.to_string())),
            account_id: token.account_id.clone(),
        };
        Self::store_credentials(&creds)?;

        Ok(token)
    }

    /// Store credentials securely in the OS keychain
    fn store_credentials(creds: &StoredCredentials) -> Result<(), String> {
        let entry =
            Entry::new(SERVICE_NAME, "credentials").map_err(|e| format!("Keyring error: {}", e))?;

        let json = serde_json::to_string(creds).map_err(|e| format!("Serialize error: {}", e))?;

        entry
            .set_password(&json)
            .map_err(|e| format!("Failed to store credentials: {}", e))
    }

    /// Retrieve stored credentials from keychain
    pub fn get_stored_credentials() -> Option<StoredCredentials> {
        let entry = Entry::new(SERVICE_NAME, "credentials").ok()?;
        let json = entry.get_password().ok()?;
        serde_json::from_str(&json).ok()
    }

    /// Check if Dropbox credentials exist
    pub fn is_connected() -> bool {
        Self::get_stored_credentials().is_some()
    }

    /// Clear stored credentials (disconnect)
    pub fn disconnect() -> Result<(), String> {
        let entry =
            Entry::new(SERVICE_NAME, "credentials").map_err(|e| format!("Keyring error: {}", e))?;

        entry
            .delete_credential()
            .map_err(|e| format!("Failed to delete credentials: {}", e))
    }

    /// Get a valid access token, refreshing if necessary
    pub async fn get_valid_token(&self) -> Result<String, String> {
        let creds = Self::get_stored_credentials().ok_or("Not connected to Dropbox")?;

        // For now, just return the stored token
        // TODO: Check expiration and refresh if needed
        Ok(creds.access_token)
    }
}

impl Default for DropboxAuth {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_verifier_generation() {
        let verifier = DropboxAuth::generate_code_verifier();
        assert!(!verifier.is_empty());
        assert!(verifier.len() >= 32);
    }

    #[test]
    fn test_code_challenge_generation() {
        let verifier = "test_verifier";
        let challenge = DropboxAuth::generate_code_challenge(verifier);
        assert!(!challenge.is_empty());
        // Challenge should be base64url encoded SHA256 hash
        assert!(challenge
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn test_auth_url_generation() {
        let mut auth = DropboxAuth::new();
        let url = auth.get_auth_url();

        assert!(url.starts_with("https://www.dropbox.com/oauth2/authorize"));
        assert!(url.contains("client_id="));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("code_challenge="));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(auth.code_verifier.is_some());
    }
}
