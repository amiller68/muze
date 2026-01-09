mod model;

pub use model::{Clip, Collection, CutRegion, EntryType, FolderEntry, Mix, Project, Track};

use std::path::Path;

// ============= Collection Operations =============

pub fn create_collection(name: &str, parent_path: &str) -> Result<Collection, String> {
    let collection = Collection::new(name);
    let safe_name = sanitize_name(name);
    let collection_path = format!("{}/{}", parent_path, safe_name);

    std::fs::create_dir_all(&collection_path).map_err(|e| e.to_string())?;

    let json = serde_json::to_string_pretty(&collection).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/collection.json", collection_path), json).map_err(|e| e.to_string())?;

    Ok(collection)
}

pub fn load_collection(collection_path: &str) -> Result<Collection, String> {
    let json = std::fs::read_to_string(format!("{}/collection.json", collection_path))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub fn save_collection(collection: &Collection, collection_path: &str) -> Result<(), String> {
    std::fs::create_dir_all(collection_path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(collection).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/collection.json", collection_path), json).map_err(|e| e.to_string())?;
    Ok(())
}

// ============= Project Operations =============

pub fn create_project(name: &str, parent_path: &str) -> Result<Project, String> {
    let project = Project::new(name);
    let safe_name = sanitize_name(name);
    let project_path = format!("{}/{}", parent_path, safe_name);

    std::fs::create_dir_all(&project_path).map_err(|e| e.to_string())?;

    let json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/project.json", project_path), json).map_err(|e| e.to_string())?;

    Ok(project)
}

pub fn load_project(project_path: &str) -> Result<Project, String> {
    let json = std::fs::read_to_string(format!("{}/project.json", project_path))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub fn save_project(project: &Project, project_path: &str) -> Result<(), String> {
    std::fs::create_dir_all(project_path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(project).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/project.json", project_path), json).map_err(|e| e.to_string())?;
    Ok(())
}

// ============= Mix Operations =============

pub fn create_mix(name: &str, parent_path: &str) -> Result<Mix, String> {
    let mix = Mix::new(name);
    let safe_name = sanitize_name(name);
    let mix_path = format!("{}/{}", parent_path, safe_name);

    std::fs::create_dir_all(&mix_path).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(format!("{}/audio", mix_path)).map_err(|e| e.to_string())?;

    let json = serde_json::to_string_pretty(&mix).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/mix.json", mix_path), json).map_err(|e| e.to_string())?;

    Ok(mix)
}

pub fn load_mix(mix_path: &str) -> Result<Mix, String> {
    // Try mix.json first, then fall back to project.json for backwards compatibility
    let mix_file = Path::new(mix_path).join("mix.json");
    let project_file = Path::new(mix_path).join("project.json");

    let json = if mix_file.exists() {
        std::fs::read_to_string(mix_file).map_err(|e| e.to_string())?
    } else if project_file.exists() {
        // Backwards compatibility with old project.json files
        std::fs::read_to_string(project_file).map_err(|e| e.to_string())?
    } else {
        return Err("Mix not found".to_string());
    };

    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub fn save_mix(mix: &Mix, mix_path: &str) -> Result<(), String> {
    std::fs::create_dir_all(mix_path).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(format!("{}/audio", mix_path)).map_err(|e| e.to_string())?;

    let json = serde_json::to_string_pretty(mix).map_err(|e| e.to_string())?;
    std::fs::write(format!("{}/mix.json", mix_path), json).map_err(|e| e.to_string())?;
    Ok(())
}

// ============= Listing Operations =============

/// List all entries in a directory, detecting their types
pub fn list_entries(path: &str) -> Result<Vec<FolderEntry>, String> {
    let mut entries = Vec::new();

    let dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Skip hidden directories
            if path.file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.starts_with('.'))
                .unwrap_or(false)
            {
                continue;
            }

            let entry_type = detect_entry_type(&path);
            let modified_at = get_modified_time(&path, &entry_type);

            entries.push(FolderEntry {
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                entry_type,
                modified_at,
            });
        }
    }

    // Sort by modified time, most recent first
    entries.sort_by(|a, b| {
        match (&b.modified_at, &a.modified_at) {
            (Some(b_time), Some(a_time)) => b_time.cmp(a_time),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.name.cmp(&b.name),
        }
    });

    Ok(entries)
}

fn detect_entry_type(path: &Path) -> EntryType {
    if path.join("collection.json").exists() {
        EntryType::Collection
    } else if path.join("project.json").exists() {
        // Check if it's an old-style mix (has tracks) or a new-style project
        if let Ok(json) = std::fs::read_to_string(path.join("project.json")) {
            if json.contains("\"tracks\"") {
                // Old-style mix stored as project.json
                return EntryType::Mix;
            }
        }
        EntryType::Project
    } else if path.join("mix.json").exists() {
        EntryType::Mix
    } else {
        EntryType::Unknown
    }
}

fn get_modified_time(path: &Path, entry_type: &EntryType) -> Option<chrono::DateTime<chrono::Utc>> {
    let json_file = match entry_type {
        EntryType::Collection => path.join("collection.json"),
        EntryType::Project => path.join("project.json"),
        EntryType::Mix => {
            let mix_file = path.join("mix.json");
            if mix_file.exists() { mix_file } else { path.join("project.json") }
        }
        EntryType::Unknown => return None,
    };

    // Try to read modified_at from the JSON file
    if let Ok(json) = std::fs::read_to_string(&json_file) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
            if let Some(modified) = value.get("modified_at").and_then(|v| v.as_str()) {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(modified) {
                    return Some(dt.with_timezone(&chrono::Utc));
                }
            }
        }
    }

    // Fall back to file system modified time
    json_file.metadata()
        .and_then(|m| m.modified())
        .ok()
        .map(|t| chrono::DateTime::from(t))
}

// ============= Helpers =============

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
