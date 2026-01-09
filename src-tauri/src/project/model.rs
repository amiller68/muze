use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============= Collection =============
// A collection can contain other collections or projects

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Collection {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

impl Collection {
    pub fn new(name: &str) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            created_at: now,
            modified_at: now,
        }
    }

    #[allow(dead_code)]
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }
}

// ============= Project =============
// A project contains mixes

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

impl Project {
    pub fn new(name: &str) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            created_at: now,
            modified_at: now,
        }
    }

    #[allow(dead_code)]
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }
}

// ============= Mix =============
// A mix contains tracks (this was previously called Project)

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Mix {
    pub version: String,
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub sample_rate: u32,
    pub tracks: Vec<Track>,
}

impl Mix {
    pub fn new(name: &str) -> Self {
        let now = Utc::now();
        Self {
            version: "1.0".to_string(),
            id: Uuid::new_v4(),
            name: name.to_string(),
            created_at: now,
            modified_at: now,
            sample_rate: 48000,
            tracks: Vec::new(),
        }
    }

    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }
}

// ============= Track =============

#[allow(dead_code)]
const TRACK_COLORS: [&str; 8] = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
];

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Track {
    pub id: Uuid,
    pub index: usize,
    pub name: String,
    pub color: String,
    pub volume: f32,
    pub muted: bool,
    pub solo: bool,
    pub clip: Option<Clip>,
}

impl Track {
    #[allow(dead_code)]
    pub fn new(index: usize, name: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            index,
            name: name.to_string(),
            color: TRACK_COLORS[index % 8].to_string(),
            volume: 0.8,
            muted: false,
            solo: false,
            clip: None,
        }
    }
}

// ============= Clip =============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Clip {
    pub id: Uuid,
    pub audio_file: String,
    pub original_duration_ms: u64,
    pub trim_start_ms: u64,
    pub trim_end_ms: u64,
    pub loop_enabled: bool,
    pub cuts: Vec<CutRegion>,
}

impl Clip {
    #[allow(dead_code)]
    pub fn new(audio_file: &str, duration_ms: u64) -> Self {
        Self {
            id: Uuid::new_v4(),
            audio_file: audio_file.to_string(),
            original_duration_ms: duration_ms,
            trim_start_ms: 0,
            trim_end_ms: duration_ms,
            loop_enabled: false,
            cuts: Vec::new(),
        }
    }

    #[allow(dead_code)]
    pub fn effective_duration_ms(&self) -> u64 {
        self.trim_end_ms - self.trim_start_ms
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CutRegion {
    pub start_ms: u64,
    pub end_ms: u64,
}

// ============= File System Entries =============

#[derive(Serialize, Clone, Debug)]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
    pub entry_type: EntryType,
    pub modified_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Collection,
    Project,
    Mix,
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collection_new_sets_timestamps() {
        let c = Collection::new("My Collection");
        assert_eq!(c.name, "My Collection");
        assert!(c.created_at <= Utc::now());
        assert_eq!(c.created_at, c.modified_at);
    }

    #[test]
    fn collection_touch_updates_modified() {
        let mut c = Collection::new("Test");
        let original = c.modified_at;
        std::thread::sleep(std::time::Duration::from_millis(10));
        c.touch();
        assert!(c.modified_at > original);
    }

    #[test]
    fn project_new_creates_valid_project() {
        let p = Project::new("Test Project");
        assert_eq!(p.name, "Test Project");
        assert!(p.created_at <= Utc::now());
    }

    #[test]
    fn mix_new_has_default_sample_rate() {
        let m = Mix::new("Test Mix");
        assert_eq!(m.sample_rate, 48000);
        assert_eq!(m.version, "1.0");
        assert!(m.tracks.is_empty());
    }

    #[test]
    fn track_colors_cycle() {
        let t0 = Track::new(0, "Track 1");
        let t8 = Track::new(8, "Track 9");
        assert_eq!(t0.color, t8.color); // Index 8 wraps to color 0
    }

    #[test]
    fn track_default_values() {
        let t = Track::new(0, "Track");
        assert_eq!(t.volume, 0.8);
        assert!(!t.muted);
        assert!(!t.solo);
        assert!(t.clip.is_none());
    }

    #[test]
    fn clip_effective_duration() {
        let mut c = Clip::new("audio.wav", 10000);
        assert_eq!(c.effective_duration_ms(), 10000);

        c.trim_start_ms = 1000;
        c.trim_end_ms = 8000;
        assert_eq!(c.effective_duration_ms(), 7000);
    }

    #[test]
    fn model_serialization_roundtrip() {
        let mix = Mix::new("Serialization Test");
        let json = serde_json::to_string(&mix).unwrap();
        let deserialized: Mix = serde_json::from_str(&json).unwrap();
        assert_eq!(mix.name, deserialized.name);
        assert_eq!(mix.sample_rate, deserialized.sample_rate);
    }
}
