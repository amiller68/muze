use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============= Vault Provider =============

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VaultProvider {
    Local,
    Icloud,
    Dropbox,
}

// ============= Sync Status =============

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Synced,
    Syncing,
    Error,
    Offline,
}

// ============= Vault =============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Vault {
    pub id: Uuid,
    pub name: String,
    pub provider: VaultProvider,
    pub path: String,
    pub is_default: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_synced: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_status: Option<SyncStatus>,
}

impl Vault {
    pub fn new_local(name: &str, path: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            provider: VaultProvider::Local,
            path: path.to_string(),
            is_default: false,
            last_synced: None,
            sync_status: None,
        }
    }

    pub fn new_default_local(path: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: "Local".to_string(),
            provider: VaultProvider::Local,
            path: path.to_string(),
            is_default: true,
            last_synced: None,
            sync_status: None,
        }
    }
}

// ============= Vault Registry =============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultRegistry {
    pub version: String,
    pub active_vault_id: Uuid,
    pub vaults: Vec<Vault>,
}

impl VaultRegistry {
    pub fn new_with_default(default_path: &str) -> Self {
        let default_vault = Vault::new_default_local(default_path);
        let active_id = default_vault.id;
        Self {
            version: "1.0".to_string(),
            active_vault_id: active_id,
            vaults: vec![default_vault],
        }
    }

    pub fn active_vault(&self) -> Option<&Vault> {
        self.vaults.iter().find(|v| v.id == self.active_vault_id)
    }

    #[allow(dead_code)] // Will be used when implementing vault sync features
    pub fn find_vault(&self, id: &Uuid) -> Option<&Vault> {
        self.vaults.iter().find(|v| &v.id == id)
    }

    pub fn add_vault(&mut self, vault: Vault) {
        self.vaults.push(vault);
    }

    pub fn remove_vault(&mut self, id: &Uuid) -> bool {
        if let Some(pos) = self.vaults.iter().position(|v| &v.id == id) {
            // Don't remove if it's the only vault or if it's the active vault
            if self.vaults.len() > 1 && self.active_vault_id != *id {
                self.vaults.remove(pos);
                return true;
            }
        }
        false
    }

    pub fn set_active(&mut self, id: Uuid) -> bool {
        if self.vaults.iter().any(|v| v.id == id) {
            self.active_vault_id = id;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_new_local_creates_valid_vault() {
        let v = Vault::new_local("My Vault", "/path/to/vault");
        assert_eq!(v.name, "My Vault");
        assert_eq!(v.path, "/path/to/vault");
        assert_eq!(v.provider, VaultProvider::Local);
        assert!(!v.is_default);
    }

    #[test]
    fn vault_new_default_local_sets_default() {
        let v = Vault::new_default_local("/path/to/default");
        assert_eq!(v.name, "Local");
        assert!(v.is_default);
    }

    #[test]
    fn registry_new_with_default_creates_one_vault() {
        let r = VaultRegistry::new_with_default("/default/path");
        assert_eq!(r.vaults.len(), 1);
        assert!(r.active_vault().is_some());
        assert_eq!(r.active_vault().unwrap().name, "Local");
    }

    #[test]
    fn registry_add_vault() {
        let mut r = VaultRegistry::new_with_default("/default");
        let new_vault = Vault::new_local("Second", "/second");
        r.add_vault(new_vault);
        assert_eq!(r.vaults.len(), 2);
    }

    #[test]
    fn registry_set_active() {
        let mut r = VaultRegistry::new_with_default("/default");
        let new_vault = Vault::new_local("Second", "/second");
        let new_id = new_vault.id;
        r.add_vault(new_vault);

        assert!(r.set_active(new_id));
        assert_eq!(r.active_vault_id, new_id);
    }

    #[test]
    fn registry_cannot_remove_only_vault() {
        let mut r = VaultRegistry::new_with_default("/default");
        let id = r.vaults[0].id;
        assert!(!r.remove_vault(&id));
        assert_eq!(r.vaults.len(), 1);
    }

    #[test]
    fn registry_cannot_remove_active_vault() {
        let mut r = VaultRegistry::new_with_default("/default");
        let new_vault = Vault::new_local("Second", "/second");
        r.add_vault(new_vault);
        let active_id = r.active_vault_id;
        assert!(!r.remove_vault(&active_id));
    }

    #[test]
    fn registry_can_remove_inactive_vault() {
        let mut r = VaultRegistry::new_with_default("/default");
        let new_vault = Vault::new_local("Second", "/second");
        let new_id = new_vault.id;
        r.add_vault(new_vault);
        assert!(r.remove_vault(&new_id));
        assert_eq!(r.vaults.len(), 1);
    }

    #[test]
    fn model_serialization_roundtrip() {
        let registry = VaultRegistry::new_with_default("/test/path");
        let json = serde_json::to_string(&registry).unwrap();
        let deserialized: VaultRegistry = serde_json::from_str(&json).unwrap();
        assert_eq!(registry.version, deserialized.version);
        assert_eq!(registry.vaults.len(), deserialized.vaults.len());
    }

    #[test]
    fn provider_serializes_as_snake_case() {
        let vault = Vault::new_local("Test", "/test");
        let json = serde_json::to_string(&vault).unwrap();
        assert!(json.contains("\"provider\":\"local\""));
    }
}
