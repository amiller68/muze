pub mod model;

use model::{Vault, VaultProvider, VaultRegistry};
use std::fs;
use std::path::PathBuf;

/// Get the path where vault registry is stored
fn get_registry_path() -> PathBuf {
    #[cfg(target_os = "ios")]
    {
        // iOS: Store in Documents directory (same as project data)
        if let Some(docs) = dirs::document_dir() {
            return docs.join("vaults.json");
        }
    }

    #[cfg(not(target_os = "ios"))]
    {
        // macOS/Linux: Store in Application Support
        if let Some(config) = dirs::config_dir() {
            let app_dir = config.join("com.krondor.muze");
            if !app_dir.exists() {
                let _ = fs::create_dir_all(&app_dir);
            }
            return app_dir.join("vaults.json");
        }
    }

    // Fallback
    PathBuf::from("vaults.json")
}

/// Get the default projects path for creating the initial vault
fn get_default_projects_path() -> String {
    #[cfg(target_os = "ios")]
    {
        if let Some(docs) = dirs::document_dir() {
            let muze_dir = docs.join("Muze");
            if !muze_dir.exists() {
                let _ = fs::create_dir_all(&muze_dir);
            }
            return muze_dir.to_string_lossy().to_string();
        }
    }

    #[cfg(not(target_os = "ios"))]
    {
        if let Some(home) = dirs::home_dir() {
            let muze_dir = home.join("Music").join("Muze");
            if !muze_dir.exists() {
                let _ = fs::create_dir_all(&muze_dir);
            }
            return muze_dir.to_string_lossy().to_string();
        }
    }

    ".".to_string()
}

/// Load the vault registry, creating a default one if it doesn't exist
pub fn load_registry() -> Result<VaultRegistry, String> {
    let path = get_registry_path();

    if path.exists() {
        let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let registry: VaultRegistry = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        Ok(registry)
    } else {
        // Create default registry with local vault
        let default_path = get_default_projects_path();
        let registry = VaultRegistry::new_with_default(&default_path);
        save_registry(&registry)?;
        Ok(registry)
    }
}

/// Save the vault registry to disk
pub fn save_registry(registry: &VaultRegistry) -> Result<(), String> {
    let path = get_registry_path();

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let contents = serde_json::to_string_pretty(registry).map_err(|e| e.to_string())?;
    fs::write(&path, contents).map_err(|e| e.to_string())
}

// ============= Tauri Commands =============

#[tauri::command]
pub fn load_vault_registry() -> Result<VaultRegistry, String> {
    load_registry()
}

#[tauri::command]
pub fn save_vault_registry(registry: VaultRegistry) -> Result<(), String> {
    save_registry(&registry)
}

#[tauri::command]
pub fn create_vault(name: String, provider: VaultProvider, path: String) -> Result<Vault, String> {
    let mut registry = load_registry()?;

    let vault = match provider {
        VaultProvider::Local => Vault::new_local(&name, &path),
        VaultProvider::Icloud | VaultProvider::Dropbox => {
            // For now, create as local - cloud providers will be implemented in later phases
            let mut v = Vault::new_local(&name, &path);
            v.provider = provider;
            v
        }
    };

    // Ensure the vault path exists for local vaults
    if vault.provider == VaultProvider::Local {
        let vault_path = std::path::Path::new(&vault.path);
        if !vault_path.exists() {
            fs::create_dir_all(vault_path).map_err(|e| e.to_string())?;
        }
    }

    let created_vault = vault.clone();
    registry.add_vault(vault);
    save_registry(&registry)?;

    Ok(created_vault)
}

#[tauri::command]
pub fn delete_vault(vault_id: String) -> Result<bool, String> {
    let mut registry = load_registry()?;
    let id = uuid::Uuid::parse_str(&vault_id).map_err(|e| e.to_string())?;

    let removed = registry.remove_vault(&id);
    if removed {
        save_registry(&registry)?;
    }

    Ok(removed)
}

#[tauri::command]
pub fn set_active_vault(vault_id: String) -> Result<bool, String> {
    let mut registry = load_registry()?;
    let id = uuid::Uuid::parse_str(&vault_id).map_err(|e| e.to_string())?;

    let success = registry.set_active(id);
    if success {
        save_registry(&registry)?;
    }

    Ok(success)
}

#[tauri::command]
pub fn get_active_vault_path() -> Result<String, String> {
    let registry = load_registry()?;
    registry
        .active_vault()
        .map(|v| v.path.clone())
        .ok_or_else(|| "No active vault".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;

    // Use a mutex to ensure tests don't interfere with each other
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    fn setup_test_env() -> PathBuf {
        let temp_dir = env::temp_dir().join(format!("muze_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        temp_dir
    }

    fn cleanup_test_env(path: &PathBuf) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn test_load_registry_creates_default() {
        let _guard = TEST_MUTEX.lock().unwrap();

        // This test uses the actual registry path, so we just verify it doesn't error
        let result = load_registry();
        assert!(result.is_ok());

        let registry = result.unwrap();
        assert!(!registry.vaults.is_empty());
        assert!(registry.active_vault().is_some());
    }

    #[test]
    fn test_vault_model_integration() {
        let vault = Vault::new_local("Test", "/test/path");
        assert_eq!(vault.provider, VaultProvider::Local);

        let json = serde_json::to_string(&vault).unwrap();
        let deserialized: Vault = serde_json::from_str(&json).unwrap();
        assert_eq!(vault.name, deserialized.name);
        assert_eq!(vault.path, deserialized.path);
    }
}
