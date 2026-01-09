use super::recorder::{Recorder, RecordingResult};
use crossbeam_channel::{bounded, Receiver, Sender};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::thread;
use thiserror::Error;

/// A loaded audio track ready for playback
#[derive(Clone)]
pub struct LoadedTrack {
    pub samples: Vec<f32>,  // Mono audio samples
    pub sample_rate: u32,
    pub volume: f32,
    pub muted: bool,
}

/// Shared track data for playback
pub struct TrackData {
    pub tracks: Vec<LoadedTrack>,
}

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("No output device available")]
    NoOutputDevice,
    #[error("No input device available")]
    NoInputDevice,
    #[error("Failed to get device config: {0}")]
    ConfigError(String),
    #[error("Failed to build stream: {0}")]
    StreamError(String),
    #[error("Audio thread failed to start")]
    ThreadError,
}

/// Track info for loading
#[derive(Debug, Clone)]
pub struct TrackInfo {
    pub audio_path: String,
    pub volume: f32,
    pub muted: bool,
}

/// Commands that can be sent to the audio thread
#[derive(Debug)]
pub enum AudioCommand {
    Play,
    Pause,
    Stop,
    Seek(u64),
    LoadTracks(Vec<TrackInfo>),
    StartRecording { track_index: usize, output_path: String },
    StopRecording,
    Shutdown,
}

/// Events sent back from the audio thread
#[derive(Debug, Clone)]
pub enum AudioEvent {
    RecordingStarted { track_index: usize },
    RecordingStopped { result: RecordingResult },
    RecordingError { error: String },
    InputLevel { level: f32 },
}

/// Shared state between the main thread and audio callback
pub struct SharedState {
    pub is_playing: AtomicBool,
    pub is_recording: AtomicBool,
    pub recording_track: AtomicU64, // Using u64 to store Option<usize> as MAX = None
    pub playhead_samples: AtomicU64,
    pub sample_rate: AtomicU64,
    pub input_level: std::sync::atomic::AtomicU32, // f32 bits stored as u32
    pub track_data: RwLock<TrackData>,
}

impl Default for SharedState {
    fn default() -> Self {
        Self {
            is_playing: AtomicBool::new(false),
            is_recording: AtomicBool::new(false),
            recording_track: AtomicU64::new(u64::MAX),
            playhead_samples: AtomicU64::new(0),
            sample_rate: AtomicU64::new(48000),
            input_level: std::sync::atomic::AtomicU32::new(0),
            track_data: RwLock::new(TrackData { tracks: Vec::new() }),
        }
    }
}

impl SharedState {
    pub fn set_input_level(&self, level: f32) {
        self.input_level.store(level.to_bits(), Ordering::SeqCst);
    }

    pub fn get_input_level(&self) -> f32 {
        f32::from_bits(self.input_level.load(Ordering::SeqCst))
    }
}

/// The audio engine handle - this is what gets stored in Tauri state
pub struct AudioEngine {
    shared_state: Arc<SharedState>,
    command_tx: Sender<AudioCommand>,
    event_rx: Receiver<AudioEvent>,
    is_dummy: bool,
}

unsafe impl Send for AudioEngine {}
unsafe impl Sync for AudioEngine {}

impl Drop for AudioEngine {
    fn drop(&mut self) {
        let _ = self.command_tx.try_send(AudioCommand::Shutdown);
    }
}

impl AudioEngine {
    pub fn new() -> Result<Self, AudioError> {
        let shared_state = Arc::new(SharedState::default());
        let (command_tx, command_rx) = bounded::<AudioCommand>(64);
        let (event_tx, event_rx) = bounded::<AudioEvent>(64);

        let audio_shared_state = shared_state.clone();

        thread::spawn(move || {
            if let Err(e) = run_audio_thread(audio_shared_state, command_rx, event_tx) {
                eprintln!("Audio thread error: {}", e);
            }
        });

        Ok(Self {
            shared_state,
            command_tx,
            event_rx,
            is_dummy: false,
        })
    }

    pub fn dummy() -> Self {
        let (command_tx, _) = bounded(64);
        let (_, event_rx) = bounded(64);
        Self {
            shared_state: Arc::new(SharedState::default()),
            command_tx,
            event_rx,
            is_dummy: true,
        }
    }

    pub fn play(&self) {
        if !self.is_dummy {
            let _ = self.command_tx.try_send(AudioCommand::Play);
        }
    }

    pub fn pause(&self) {
        if !self.is_dummy {
            let _ = self.command_tx.try_send(AudioCommand::Pause);
        }
    }

    pub fn stop(&self) {
        if !self.is_dummy {
            let _ = self.command_tx.try_send(AudioCommand::Stop);
        }
    }

    pub fn seek(&self, position_ms: u64) {
        if !self.is_dummy {
            let sample_rate = self.shared_state.sample_rate.load(Ordering::SeqCst);
            let samples = (position_ms as f64 * sample_rate as f64 / 1000.0) as u64;
            let _ = self.command_tx.try_send(AudioCommand::Seek(samples));
        }
    }

    pub fn start_recording(&self, track_index: usize, output_path: &str) -> Result<(), String> {
        if self.is_dummy {
            return Err("Audio engine not available".to_string());
        }
        self.command_tx
            .try_send(AudioCommand::StartRecording {
                track_index,
                output_path: output_path.to_string(),
            })
            .map_err(|e| e.to_string())
    }

    pub fn stop_recording(&self) -> Result<(), String> {
        if self.is_dummy {
            return Err("Audio engine not available".to_string());
        }
        self.command_tx
            .try_send(AudioCommand::StopRecording)
            .map_err(|e| e.to_string())
    }

    pub fn is_playing(&self) -> bool {
        self.shared_state.is_playing.load(Ordering::SeqCst)
    }

    pub fn is_recording(&self) -> bool {
        self.shared_state.is_recording.load(Ordering::SeqCst)
    }

    pub fn position_ms(&self) -> u64 {
        let samples = self.shared_state.playhead_samples.load(Ordering::SeqCst);
        let sample_rate = self.shared_state.sample_rate.load(Ordering::SeqCst);
        (samples as f64 * 1000.0 / sample_rate as f64) as u64
    }

    pub fn input_level(&self) -> f32 {
        self.shared_state.get_input_level()
    }

    pub fn load_tracks(&self, tracks: Vec<TrackInfo>) -> Result<(), String> {
        if self.is_dummy {
            return Ok(());
        }
        self.command_tx
            .try_send(AudioCommand::LoadTracks(tracks))
            .map_err(|e| e.to_string())
    }

    pub fn poll_event(&self) -> Option<AudioEvent> {
        self.event_rx.try_recv().ok()
    }
}

/// Load a WAV file and return samples at the target sample rate
fn load_wav_file(path: &str, target_sample_rate: u32) -> Result<Vec<f32>, String> {
    use hound::WavReader;

    let reader = WavReader::open(path).map_err(|e| format!("Failed to open {}: {}", path, e))?;
    let spec = reader.spec();
    let channels = spec.channels as usize;
    let source_rate = spec.sample_rate;

    // Read all samples
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => {
            reader.into_samples::<f32>()
                .filter_map(|s| s.ok())
                .collect()
        }
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let max_val = (1 << (bits - 1)) as f32;
            reader.into_samples::<i32>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / max_val)
                .collect()
        }
    };

    // Convert to mono if stereo
    let mono: Vec<f32> = if channels == 2 {
        samples.chunks(2)
            .map(|chunk| (chunk[0] + chunk.get(1).unwrap_or(&0.0)) * 0.5)
            .collect()
    } else {
        samples
    };

    // Simple linear resampling if needed
    if source_rate != target_sample_rate {
        let ratio = source_rate as f64 / target_sample_rate as f64;
        let new_len = (mono.len() as f64 / ratio) as usize;
        let mut resampled = Vec::with_capacity(new_len);
        for i in 0..new_len {
            let src_idx = (i as f64 * ratio) as usize;
            resampled.push(mono.get(src_idx).copied().unwrap_or(0.0));
        }
        Ok(resampled)
    } else {
        Ok(mono)
    }
}

/// Audio thread - manages both input and output streams
fn run_audio_thread(
    shared_state: Arc<SharedState>,
    command_rx: Receiver<AudioCommand>,
    event_tx: Sender<AudioEvent>,
) -> Result<(), AudioError> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();

    // Setup output device
    let output_device = host
        .default_output_device()
        .ok_or(AudioError::NoOutputDevice)?;

    let output_config = output_device
        .default_output_config()
        .map_err(|e| AudioError::ConfigError(e.to_string()))?;

    let sample_rate = output_config.sample_rate().0;
    let output_channels = output_config.channels() as usize;

    shared_state.sample_rate.store(sample_rate as u64, Ordering::SeqCst);

    // Setup input device
    let input_device = host
        .default_input_device()
        .ok_or(AudioError::NoInputDevice)?;

    let input_config = input_device
        .default_input_config()
        .map_err(|e| AudioError::ConfigError(e.to_string()))?;

    let input_channels = input_config.channels() as usize;
    let input_sample_rate = input_config.sample_rate().0;

    // Create recorder (will be started/stopped via commands)
    let recorder = Arc::new(std::sync::Mutex::new(Recorder::new(input_sample_rate, 1))); // Mono recording

    // Clone for input callback
    let input_recorder = recorder.clone();
    let input_shared_state = shared_state.clone();

    // Build input stream
    let input_stream = input_device
        .build_input_stream(
            &input_config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Calculate input level
                let mut peak: f32 = 0.0;
                for &sample in data.iter() {
                    let abs = sample.abs();
                    if abs > peak {
                        peak = abs;
                    }
                }
                input_shared_state.set_input_level(peak);

                // If recording, write samples
                if input_shared_state.is_recording.load(Ordering::SeqCst) {
                    if let Ok(mut rec) = input_recorder.try_lock() {
                        // Convert to mono if stereo
                        if input_channels == 2 {
                            let mono: Vec<f32> = data
                                .chunks(2)
                                .map(|chunk| (chunk[0] + chunk.get(1).unwrap_or(&0.0)) * 0.5)
                                .collect();
                            let _ = rec.write_samples(&mono);
                        } else {
                            let _ = rec.write_samples(data);
                        }
                    }
                }
            },
            |err| {
                eprintln!("Input stream error: {}", err);
            },
            None,
        )
        .map_err(|e| AudioError::StreamError(e.to_string()))?;

    // Clone for output callback
    let output_shared_state = shared_state.clone();

    // Build output stream
    let output_stream = output_device
        .build_output_stream(
            &output_config.into(),
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                let is_playing = output_shared_state.is_playing.load(Ordering::SeqCst);

                if !is_playing {
                    data.fill(0.0);
                    return;
                }

                let playhead = output_shared_state.playhead_samples.load(Ordering::SeqCst) as usize;

                // Mix tracks
                if let Ok(track_data) = output_shared_state.track_data.read() {
                    let num_frames = data.len() / output_channels;

                    for (frame_idx, frame) in data.chunks_mut(output_channels).enumerate() {
                        let sample_idx = playhead + frame_idx;
                        let mut mixed_sample: f32 = 0.0;

                        for track in &track_data.tracks {
                            if !track.muted && sample_idx < track.samples.len() {
                                mixed_sample += track.samples[sample_idx] * track.volume;
                            }
                        }

                        // Clamp to prevent clipping
                        mixed_sample = mixed_sample.clamp(-1.0, 1.0);

                        for channel_sample in frame.iter_mut() {
                            *channel_sample = mixed_sample;
                        }
                    }

                    output_shared_state.playhead_samples.fetch_add(num_frames as u64, Ordering::SeqCst);
                } else {
                    data.fill(0.0);
                }
            },
            |err| {
                eprintln!("Output stream error: {}", err);
            },
            None,
        )
        .map_err(|e| AudioError::StreamError(e.to_string()))?;

    // Start streams
    input_stream.play().map_err(|e| AudioError::StreamError(e.to_string()))?;
    output_stream.play().map_err(|e| AudioError::StreamError(e.to_string()))?;

    // Command processing loop
    loop {
        match command_rx.recv() {
            Ok(AudioCommand::Play) => {
                shared_state.is_playing.store(true, Ordering::SeqCst);
            }
            Ok(AudioCommand::Pause) => {
                shared_state.is_playing.store(false, Ordering::SeqCst);
            }
            Ok(AudioCommand::Stop) => {
                shared_state.is_playing.store(false, Ordering::SeqCst);
                shared_state.playhead_samples.store(0, Ordering::SeqCst);

                // Also stop recording if active
                if shared_state.is_recording.load(Ordering::SeqCst) {
                    shared_state.is_recording.store(false, Ordering::SeqCst);
                    if let Ok(mut rec) = recorder.lock() {
                        if let Ok(result) = rec.stop() {
                            let _ = event_tx.try_send(AudioEvent::RecordingStopped { result });
                        }
                    }
                }
            }
            Ok(AudioCommand::Seek(position)) => {
                shared_state.playhead_samples.store(position, Ordering::SeqCst);
            }
            Ok(AudioCommand::LoadTracks(track_infos)) => {
                let mut loaded_tracks = Vec::new();
                for info in track_infos {
                    match load_wav_file(&info.audio_path, sample_rate) {
                        Ok(samples) => {
                            loaded_tracks.push(LoadedTrack {
                                samples,
                                sample_rate,
                                volume: info.volume,
                                muted: info.muted,
                            });
                        }
                        Err(e) => {
                            eprintln!("Failed to load track {}: {}", info.audio_path, e);
                        }
                    }
                }
                if let Ok(mut data) = shared_state.track_data.write() {
                    data.tracks = loaded_tracks;
                }
            }
            Ok(AudioCommand::StartRecording { track_index, output_path }) => {
                if let Ok(mut rec) = recorder.lock() {
                    match rec.start(&output_path) {
                        Ok(()) => {
                            shared_state.is_recording.store(true, Ordering::SeqCst);
                            shared_state.recording_track.store(track_index as u64, Ordering::SeqCst);
                            let _ = event_tx.try_send(AudioEvent::RecordingStarted { track_index });
                        }
                        Err(e) => {
                            let _ = event_tx.try_send(AudioEvent::RecordingError {
                                error: e.to_string(),
                            });
                        }
                    }
                }
            }
            Ok(AudioCommand::StopRecording) => {
                shared_state.is_recording.store(false, Ordering::SeqCst);
                shared_state.recording_track.store(u64::MAX, Ordering::SeqCst);

                if let Ok(mut rec) = recorder.lock() {
                    match rec.stop() {
                        Ok(result) => {
                            let _ = event_tx.try_send(AudioEvent::RecordingStopped { result });
                        }
                        Err(e) => {
                            let _ = event_tx.try_send(AudioEvent::RecordingError {
                                error: e.to_string(),
                            });
                        }
                    }
                }
            }
            Ok(AudioCommand::Shutdown) | Err(_) => {
                // Stop recording before shutdown
                if shared_state.is_recording.load(Ordering::SeqCst) {
                    if let Ok(mut rec) = recorder.lock() {
                        let _ = rec.stop();
                    }
                }
                break;
            }
        }
    }

    Ok(())
}
