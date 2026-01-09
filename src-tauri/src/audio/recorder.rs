use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RecorderError {
    #[error("Failed to create file: {0}")]
    FileError(String),
    #[error("Failed to write WAV: {0}")]
    WavError(String),
    #[error("Recorder not started")]
    NotStarted,
}

pub struct Recorder {
    writer: Option<WavWriter<BufWriter<File>>>,
    spec: WavSpec,
    samples_written: u64,
    peak_level: f32,
}

impl Recorder {
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        Self {
            writer: None,
            spec: WavSpec {
                channels,
                sample_rate,
                bits_per_sample: 32,
                sample_format: hound::SampleFormat::Float,
            },
            samples_written: 0,
            peak_level: 0.0,
        }
    }

    pub fn start(&mut self, output_path: &str) -> Result<(), RecorderError> {
        // Ensure parent directory exists
        if let Some(parent) = Path::new(output_path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| RecorderError::FileError(e.to_string()))?;
        }

        let file = File::create(output_path)
            .map_err(|e| RecorderError::FileError(e.to_string()))?;

        let writer = WavWriter::new(BufWriter::new(file), self.spec)
            .map_err(|e| RecorderError::WavError(e.to_string()))?;

        self.writer = Some(writer);
        self.samples_written = 0;
        self.peak_level = 0.0;

        Ok(())
    }

    pub fn write_samples(&mut self, samples: &[f32]) -> Result<(), RecorderError> {
        if let Some(ref mut writer) = self.writer {
            for &sample in samples {
                writer.write_sample(sample)
                    .map_err(|e| RecorderError::WavError(e.to_string()))?;

                // Track peak level for metering
                let abs_sample = sample.abs();
                if abs_sample > self.peak_level {
                    self.peak_level = abs_sample;
                }
            }
            self.samples_written += samples.len() as u64;
            Ok(())
        } else {
            Err(RecorderError::NotStarted)
        }
    }

    pub fn stop(&mut self) -> Result<RecordingResult, RecorderError> {
        if let Some(writer) = self.writer.take() {
            writer.finalize()
                .map_err(|e| RecorderError::WavError(e.to_string()))?;

            let duration_samples = self.samples_written / self.spec.channels as u64;
            let duration_ms = (duration_samples as f64 * 1000.0 / self.spec.sample_rate as f64) as u64;

            Ok(RecordingResult {
                samples_written: self.samples_written,
                duration_ms,
            })
        } else {
            Err(RecorderError::NotStarted)
        }
    }

    pub fn is_recording(&self) -> bool {
        self.writer.is_some()
    }

    pub fn peak_level(&self) -> f32 {
        self.peak_level
    }

    pub fn reset_peak(&mut self) {
        self.peak_level = 0.0;
    }

    pub fn samples_written(&self) -> u64 {
        self.samples_written
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RecordingResult {
    pub samples_written: u64,
    pub duration_ms: u64,
}

/// Splice a new recording into an existing audio file
/// Keeps: original[0:start_ms] + new_recording + original[start_ms + new_duration:]
pub fn splice_audio(
    original_path: &str,
    new_recording_path: &str,
    start_ms: u64,
    output_path: &str,
) -> Result<u64, String> {
    use hound::WavReader;

    // Read original audio
    let mut original_reader = WavReader::open(original_path)
        .map_err(|e| format!("Failed to open original: {}", e))?;
    let original_spec = original_reader.spec();
    let sample_rate = original_spec.sample_rate;
    let channels = original_spec.channels as u64;

    // Read all original samples
    let original_samples: Vec<f32> = if original_spec.sample_format == hound::SampleFormat::Float {
        original_reader.samples::<f32>()
            .filter_map(|s| s.ok())
            .collect()
    } else {
        original_reader.samples::<i16>()
            .filter_map(|s| s.ok())
            .map(|s| s as f32 / 32768.0)
            .collect()
    };

    // Read new recording
    let mut new_reader = WavReader::open(new_recording_path)
        .map_err(|e| format!("Failed to open new recording: {}", e))?;
    let new_samples: Vec<f32> = if new_reader.spec().sample_format == hound::SampleFormat::Float {
        new_reader.samples::<f32>()
            .filter_map(|s| s.ok())
            .collect()
    } else {
        new_reader.samples::<i16>()
            .filter_map(|s| s.ok())
            .map(|s| s as f32 / 32768.0)
            .collect()
    };

    // Calculate sample positions
    let start_sample = ((start_ms as f64 / 1000.0) * sample_rate as f64) as usize * channels as usize;
    let new_length_samples = new_samples.len();
    let end_sample = start_sample + new_length_samples;

    // Build spliced audio
    let mut spliced: Vec<f32> = Vec::new();

    // Part 1: Original before start point (or all of original if start is beyond end)
    if start_sample > 0 {
        let copy_end = start_sample.min(original_samples.len());
        spliced.extend_from_slice(&original_samples[..copy_end]);

        // If start is beyond original length, pad with silence
        if start_sample > original_samples.len() {
            let silence_samples = start_sample - original_samples.len();
            spliced.extend(std::iter::repeat(0.0f32).take(silence_samples));
        }
    }

    // Part 2: New recording
    spliced.extend_from_slice(&new_samples);

    // Part 3: Original after the replaced section
    if end_sample < original_samples.len() {
        spliced.extend_from_slice(&original_samples[end_sample..]);
    }

    // Write output
    let output_spec = WavSpec {
        channels: channels as u16,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    // Ensure parent directory exists
    if let Some(parent) = Path::new(output_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = File::create(output_path).map_err(|e| e.to_string())?;
    let mut writer = WavWriter::new(BufWriter::new(file), output_spec)
        .map_err(|e| e.to_string())?;

    for sample in &spliced {
        writer.write_sample(*sample).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())?;

    // Calculate total duration
    let total_samples = spliced.len() as u64 / channels;
    let total_duration_ms = (total_samples as f64 * 1000.0 / sample_rate as f64) as u64;

    Ok(total_duration_ms)
}
