mod audio;
mod commands;
mod project;

use audio::AudioEngine;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the audio engine
    let engine: Arc<AudioEngine> = match AudioEngine::new() {
        Ok(engine) => Arc::new(engine),
        Err(e) => {
            eprintln!("Failed to initialize audio engine: {}", e);
            Arc::new(AudioEngine::dummy())
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(engine)
        .invoke_handler(tauri::generate_handler![
            // Transport
            commands::play,
            commands::pause,
            commands::stop,
            commands::seek,
            commands::get_position,
            commands::is_playing,
            // Recording
            commands::start_recording,
            commands::stop_recording,
            commands::is_recording,
            commands::get_input_level,
            // Collection
            commands::create_collection,
            commands::load_collection,
            // Project/Mix (backwards compatible)
            commands::create_project,
            commands::load_project,
            commands::save_project,
            commands::list_projects,
            // Project folder
            commands::create_project_folder,
            // Mix
            commands::create_mix,
            commands::load_mix,
            commands::save_mix,
            commands::list_entries,
            // File system
            commands::get_default_projects_path,
            commands::delete_entry,
            // Audio
            commands::load_tracks,
            commands::splice_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
