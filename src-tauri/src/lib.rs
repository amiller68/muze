mod audio;
mod commands;
mod dropbox;
mod project;
mod vault;

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
            // Mix
            commands::create_mix,
            commands::load_mix,
            commands::save_mix,
            commands::list_entries,
            // File system
            commands::get_default_projects_path,
            commands::delete_entry,
            commands::move_entry,
            // Audio
            commands::load_tracks,
            commands::splice_recording,
            commands::trim_audio,
            commands::export_mix_to_file,
            commands::export_and_share,
            // Vault
            vault::load_vault_registry,
            vault::save_vault_registry,
            vault::create_vault,
            vault::delete_vault,
            vault::set_active_vault,
            vault::get_active_vault_path,
            // Dropbox
            dropbox::dropbox_get_auth_url,
            dropbox::dropbox_exchange_code,
            dropbox::dropbox_is_connected,
            dropbox::dropbox_disconnect,
            dropbox::dropbox_list_folder,
            dropbox::dropbox_download_file,
            dropbox::dropbox_upload_file,
            dropbox::dropbox_create_folder,
            dropbox::dropbox_get_sync_status,
            dropbox::dropbox_content_hash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
