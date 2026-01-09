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
