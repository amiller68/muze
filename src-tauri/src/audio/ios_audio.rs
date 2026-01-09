//! iOS-specific audio session configuration
//!
//! On iOS, AVAudioSession must be configured before cpal can access audio hardware.

#[cfg(target_os = "ios")]
pub fn configure_audio_session() -> Result<(), String> {
    use objc2_avf_audio::{
        AVAudioSession, AVAudioSessionCategoryOptions, AVAudioSessionCategoryPlayAndRecord,
        AVAudioSessionModeDefault,
    };

    unsafe {
        let session = AVAudioSession::sharedInstance();

        // Get category and mode - these are Option<&NSString>
        let category =
            AVAudioSessionCategoryPlayAndRecord.ok_or("PlayAndRecord category not available")?;
        let mode = AVAudioSessionModeDefault.ok_or("Default mode not available")?;

        // Configure options for speaker output and bluetooth
        #[allow(deprecated)]
        let options = AVAudioSessionCategoryOptions::DefaultToSpeaker
            | AVAudioSessionCategoryOptions::AllowBluetooth;

        // Set category
        session
            .setCategory_mode_options_error(category, mode, options)
            .map_err(|e| format!("Failed to set audio category: {:?}", e))?;

        // Activate the session
        session
            .setActive_error(true)
            .map_err(|e| format!("Failed to activate audio session: {:?}", e))?;

        println!("iOS audio session configured successfully");
        Ok(())
    }
}

#[cfg(not(target_os = "ios"))]
pub fn configure_audio_session() -> Result<(), String> {
    // No-op on non-iOS platforms
    Ok(())
}

/// Share a file using iOS share sheet
#[cfg(target_os = "ios")]
pub fn share_file(file_path: &str) -> Result<(), String> {
    use dispatch2::Queue;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{msg_send_id, ClassType, MainThreadMarker};
    use objc2_foundation::{NSArray, NSString, NSURL};
    use objc2_ui_kit::{UIActivityViewController, UIApplication};

    let path = file_path.to_string();

    // Dispatch to main thread - share sheet will appear async
    Queue::main().exec_async(move || {
        unsafe {
            // Now on main thread - MainThreadMarker will succeed
            let Some(mtm) = MainThreadMarker::new() else {
                eprintln!("share_file: Not on main thread despite dispatch");
                return;
            };

            let path_str = NSString::from_str(&path);
            let file_url = NSURL::fileURLWithPath(&path_str);
            let file_url_obj: Retained<AnyObject> = Retained::cast(file_url);
            let items: Retained<NSArray<AnyObject>> = NSArray::from_retained_slice(&[file_url_obj]);

            let activity_vc = UIActivityViewController::initWithActivityItems_applicationActivities(
                mtm.alloc(),
                &items,
                None,
            );

            let app = UIApplication::sharedApplication(mtm);

            // Find root view controller to present from
            for scene in app.connectedScenes().iter() {
                let key_window: Option<Retained<objc2_ui_kit::UIWindow>> =
                    msg_send_id![&*scene, keyWindow];

                if let Some(window) = key_window {
                    if let Some(root_vc) = window.rootViewController() {
                        root_vc.presentViewController_animated_completion(&activity_vc, true, None);
                        return;
                    }
                }
            }

            eprintln!("share_file: Could not find root view controller");
        }
    });

    Ok(())
}

#[cfg(not(target_os = "ios"))]
pub fn share_file(file_path: &str) -> Result<(), String> {
    // On desktop, just print the path
    println!("File exported to: {}", file_path);
    Ok(())
}
