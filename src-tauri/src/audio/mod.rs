mod engine;
mod recorder;

pub use engine::{AudioEngine, TrackInfo};
pub use recorder::{splice_audio, Recorder, RecorderError, RecordingResult};
