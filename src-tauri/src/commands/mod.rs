use crate::audio::{splice_audio, AudioEngine, TrackInfo};
use crate::project::{self, Clip, Collection, FolderEntry, Mix, Project};
use std::sync::Arc;
use tauri::State;

type EngineState<'a> = State<'a, Arc<AudioEngine>>;

// ============= Transport Commands =============

#[tauri::command]
pub fn play(engine: EngineState) -> Result<(), String> {
    engine.play();
    Ok(())
}

#[tauri::command]
pub fn pause(engine: EngineState) -> Result<(), String> {
    engine.pause();
    Ok(())
}

#[tauri::command]
pub fn stop(engine: EngineState) -> Result<(), String> {
    engine.stop();
    Ok(())
}

#[tauri::command]
pub fn seek(engine: EngineState, position_ms: u64) -> Result<(), String> {
    engine.seek(position_ms);
    Ok(())
}

#[tauri::command]
pub fn get_position(engine: EngineState) -> u64 {
    engine.position_ms()
}

#[tauri::command]
pub fn is_playing(engine: EngineState) -> bool {
    engine.is_playing()
}

// ============= Recording Commands =============

#[tauri::command]
pub fn start_recording(
    engine: EngineState,
    track_index: usize,
    project_path: String,
) -> Result<String, String> {
    // Generate unique filename
    let filename = format!(
        "track_{}_{}.wav",
        track_index,
        uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0")
    );
    let audio_path = format!("{}/audio/{}", project_path, filename);

    engine.start_recording(track_index, &audio_path)?;

    Ok(filename)
}

#[tauri::command]
pub fn stop_recording(engine: EngineState) -> Result<(), String> {
    engine.stop_recording()
}

#[tauri::command]
pub fn is_recording(engine: EngineState) -> bool {
    engine.is_recording()
}

#[tauri::command]
pub fn get_input_level(engine: EngineState) -> f32 {
    engine.input_level()
}

// ============= Collection Commands =============

#[tauri::command]
pub fn create_collection(name: String, parent_path: String) -> Result<Collection, String> {
    project::create_collection(&name, &parent_path)
}

#[tauri::command]
pub fn load_collection(collection_path: String) -> Result<Collection, String> {
    project::load_collection(&collection_path)
}

// ============= Project Commands =============

#[tauri::command]
pub fn create_project(name: String, parent_path: String) -> Result<Mix, String> {
    // For backwards compatibility, create_project creates a Mix
    // This is what the frontend expects
    project::create_mix(&name, &parent_path)
}

#[tauri::command]
pub fn load_project(project_path: String) -> Result<Mix, String> {
    // For backwards compatibility, load_project loads a Mix
    project::load_mix(&project_path)
}

#[tauri::command]
pub fn save_project(project: Mix, project_path: String) -> Result<(), String> {
    // For backwards compatibility, save_project saves a Mix
    let mut project = project;
    project.touch();
    project::save_mix(&project, &project_path)
}

#[tauri::command]
pub fn list_projects(root_path: String) -> Result<Vec<FolderEntry>, String> {
    project::list_entries(&root_path)
}

// ============= Project Folder Commands =============

#[tauri::command]
pub fn create_project_folder(name: String, parent_path: String) -> Result<Project, String> {
    project::create_project(&name, &parent_path)
}

// ============= Mix Commands =============

#[tauri::command]
pub fn create_mix(name: String, parent_path: String) -> Result<Mix, String> {
    project::create_mix(&name, &parent_path)
}

#[tauri::command]
pub fn load_mix(mix_path: String) -> Result<Mix, String> {
    project::load_mix(&mix_path)
}

#[tauri::command]
pub fn save_mix(mix: Mix, mix_path: String) -> Result<(), String> {
    let mut mix = mix;
    mix.touch();
    project::save_mix(&mix, &mix_path)
}

#[tauri::command]
pub fn list_entries(path: String) -> Result<Vec<FolderEntry>, String> {
    project::list_entries(&path)
}

// ============= Delete Commands =============

#[tauri::command]
pub fn delete_entry(entry_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&entry_path);

    // On desktop, move to trash; on iOS, delete permanently
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        trash::delete(path).map_err(|e| e.to_string())
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        if path.is_dir() {
            std::fs::remove_dir_all(path).map_err(|e| e.to_string())
        } else {
            std::fs::remove_file(path).map_err(|e| e.to_string())
        }
    }
}

// ============= File System Commands =============

#[tauri::command]
pub fn get_default_projects_path() -> String {
    // iOS: Use Documents directory (accessible via Files app)
    // macOS/Linux: Use ~/Music/Muze
    #[cfg(target_os = "ios")]
    {
        if let Some(docs) = dirs::document_dir() {
            let muze_dir = docs.join("Muze");
            if !muze_dir.exists() {
                let _ = std::fs::create_dir_all(&muze_dir);
            }
            return muze_dir.to_string_lossy().to_string();
        }
    }

    #[cfg(not(target_os = "ios"))]
    {
        if let Some(home) = dirs::home_dir() {
            let muze_dir = home.join("Music").join("Muze");
            if !muze_dir.exists() {
                let _ = std::fs::create_dir_all(&muze_dir);
            }
            return muze_dir.to_string_lossy().to_string();
        }
    }

    ".".to_string()
}

// ============= Audio Commands =============

#[tauri::command]
pub fn load_tracks(
    engine: EngineState,
    project_path: String,
    tracks: Vec<TrackLoadInfo>,
) -> Result<(), String> {
    let track_infos: Vec<TrackInfo> = tracks
        .into_iter()
        .filter_map(|t| {
            t.audio_file.map(|audio_file| TrackInfo {
                audio_path: format!("{}/{}", project_path, audio_file),
                volume: t.volume,
                muted: t.muted,
            })
        })
        .collect();

    engine.load_tracks(track_infos)
}

#[derive(serde::Deserialize)]
pub struct TrackLoadInfo {
    pub audio_file: Option<String>,
    pub volume: f32,
    pub muted: bool,
}

// ============= Audio Editing Commands =============

#[tauri::command]
pub fn splice_recording(
    original_path: String,
    new_recording_path: String,
    start_ms: u64,
    output_path: String,
) -> Result<u64, String> {
    splice_audio(&original_path, &new_recording_path, start_ms, &output_path)
}
