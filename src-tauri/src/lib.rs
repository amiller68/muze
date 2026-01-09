mod audio;
mod commands;
mod project;

use audio::{configure_audio_session, AudioEngine};
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Configure audio session (required on iOS before using cpal)
    if let Err(e) = configure_audio_session() {
        eprintln!("Failed to configure audio session: {}", e);
    }

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
            commands::is_audio_available,
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
            commands::trim_audio,
            commands::export_mix_to_file,
            commands::export_and_share,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
