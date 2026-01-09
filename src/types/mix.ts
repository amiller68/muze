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
