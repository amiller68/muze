// Hierarchy: Collection > Project > Mix > Track

export interface Collection {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  // Collections can contain other collections or projects
  children: Array<CollectionEntry | ProjectEntry>;
}

export interface CollectionEntry {
  type: "collection";
  id: string;
  name: string;
  path: string;
}

export interface ProjectEntry {
  type: "project";
  id: string;
  name: string;
  path: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  mixes: MixEntry[];
}

export interface MixEntry {
  id: string;
  name: string;
  path: string;
}

export interface Mix {
  version: string;
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  sample_rate: number;
  tracks: Track[];
}

export interface Track {
  id: string;
  index: number;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  clip: Clip | null;
}

export interface Clip {
  id: string;
  audio_file: string;
  original_duration_ms: number;
  trim_start_ms: number;
  trim_end_ms: number;
  loop_enabled: boolean;
  cuts: CutRegion[];
}

export interface CutRegion {
  start_ms: number;
  end_ms: number;
}

// Navigation state
export type NavLocation =
  | { type: "collections"; path: string }
  | { type: "project"; path: string }
  | { type: "mix"; path: string };

// File system entries for listing
export interface FolderEntry {
  name: string;
  path: string;
  entry_type: "collection" | "project" | "mix" | "unknown";
}
