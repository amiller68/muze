import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { AUTO_SAVE_DEBOUNCE_MS } from "../constants/config";
import { TRACK_COLORS } from "../constants/theme";
import type { Clip, Mix, Track } from "../types/project";

const [currentMix, setCurrentMix] = createSignal<Mix | null>(null);
const [mixPath, setMixPath] = createSignal<string | null>(null);
const [isDirty, setIsDirty] = createSignal(false);
const [selectedTrack, setSelectedTrack] = createSignal<number>(0);
const [armedTrack, setArmedTrack] = createSignal<number | null>(null);

// Auto-save helper - debounced to avoid excessive writes
let saveTimeout: number | undefined;
const autoSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = window.setTimeout(async () => {
    const mix = currentMix();
    const path = mixPath();
    if (mix && path) {
      try {
        await invoke("save_project", { project: mix, projectPath: path });
        setIsDirty(false);
      } catch (_e) {
        // Auto-save failed silently
      }
    }
  }, AUTO_SAVE_DEBOUNCE_MS);
};

export function useMixStore() {
  const createMix = async (name: string, parentPath: string) => {
    const mix = await invoke<Mix>("create_project", {
      name,
      parentPath,
    });
    const safeName = name.replace(/[^a-zA-Z0-9 \-_]/g, "_");
    setCurrentMix(mix);
    setMixPath(`${parentPath}/${safeName}`);
    setIsDirty(false);
    setSelectedTrack(0);
    return mix;
  };

  const loadMix = async (path: string) => {
    // Stop any current playback and reset position before loading new mix
    await invoke("pause").catch(() => {});
    await invoke("seek", { positionMs: 0 }).catch(() => {});

    const mix = await invoke<Mix>("load_project", { projectPath: path });
    setCurrentMix(mix);
    setMixPath(path);
    setIsDirty(false);
    if (mix.tracks.length > 0) {
      setSelectedTrack(0);
    }
    // Load audio tracks into engine
    await loadTracksIntoEngine(mix, path);
    return mix;
  };

  const loadTracksIntoEngine = async (mix: Mix, path: string) => {
    const tracks = mix.tracks.map((t) => ({
      audio_file: t.clip?.audio_file || null,
      volume: t.volume,
      muted: t.muted,
    }));
    await invoke("load_tracks", { projectPath: path, tracks }).catch(() => {});
  };

  const saveMix = async () => {
    const mix = currentMix();
    const path = mixPath();
    if (mix && path) {
      await invoke("save_project", { project: mix, projectPath: path });
      setIsDirty(false);
    }
  };

  const addTrack = () => {
    const mix = currentMix();
    if (!mix) return;

    const newIndex = mix.tracks.length;
    const newTrack: Track = {
      id: crypto.randomUUID(),
      index: newIndex,
      name: `Track ${newIndex + 1}`,
      color: TRACK_COLORS[newIndex % TRACK_COLORS.length],
      volume: 0.8,
      muted: false,
      solo: false,
      clip: null,
    };

    setCurrentMix({
      ...mix,
      tracks: [...mix.tracks, newTrack],
    });
    setSelectedTrack(newIndex);
    setIsDirty(true);
    autoSave();
  };

  const removeTrack = (trackIndex: number) => {
    const mix = currentMix();
    if (!mix || mix.tracks.length <= 1) return;

    const newTracks = mix.tracks
      .filter((_, i) => i !== trackIndex)
      .map((t, i) => ({ ...t, index: i }));

    setCurrentMix({ ...mix, tracks: newTracks });

    if (selectedTrack() >= newTracks.length) {
      setSelectedTrack(Math.max(0, newTracks.length - 1));
    }
    setIsDirty(true);
    autoSave();
  };

  const addClipToTrack = async (trackIndex: number, audioFile: string, durationMs: number) => {
    const mix = currentMix();
    const path = mixPath();
    if (!mix || !path) return;

    const clip: Clip = {
      id: crypto.randomUUID(),
      audio_file: audioFile,
      original_duration_ms: durationMs,
      trim_start_ms: 0,
      trim_end_ms: durationMs,
      loop_enabled: false,
      cuts: [],
    };

    const newTracks = mix.tracks.map((t, i) => (i === trackIndex ? { ...t, clip } : t));

    const newMix = { ...mix, tracks: newTracks };
    setCurrentMix(newMix);
    setIsDirty(true);

    // Reload tracks into engine
    await loadTracksIntoEngine(newMix, path);

    // Auto-save immediately for recordings
    autoSave();
  };

  const updateTrackVolume = async (trackIndex: number, volume: number) => {
    const mix = currentMix();
    const path = mixPath();
    if (!mix || !path) return;

    const newTracks = mix.tracks.map((t, i) =>
      i === trackIndex ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t,
    );

    const newMix = { ...mix, tracks: newTracks };
    setCurrentMix(newMix);
    setIsDirty(true);

    // Update audio engine with new volume
    await loadTracksIntoEngine(newMix, path);
    autoSave();
  };

  const updateTrackMute = async (trackIndex: number, muted: boolean) => {
    const mix = currentMix();
    const path = mixPath();
    if (!mix || !path) return;

    const newTracks = mix.tracks.map((t, i) => (i === trackIndex ? { ...t, muted } : t));

    const newMix = { ...mix, tracks: newTracks };
    setCurrentMix(newMix);
    setIsDirty(true);

    // Update audio engine with new mute state
    await loadTracksIntoEngine(newMix, path);
    autoSave();
  };

  const updateTrackSolo = async (trackIndex: number, solo: boolean) => {
    const mix = currentMix();
    const path = mixPath();
    if (!mix || !path) return;

    // When soloing, mute all other non-soloed tracks
    const newTracks = mix.tracks.map((t, i) => (i === trackIndex ? { ...t, solo } : t));

    const newMix = { ...mix, tracks: newTracks };
    setCurrentMix(newMix);
    setIsDirty(true);

    // Update audio engine
    await loadTracksIntoEngine(newMix, path);
    autoSave();
  };

  const updateClipDuration = (trackIndex: number, durationMs: number) => {
    const mix = currentMix();
    if (!mix) return;

    const newTracks = mix.tracks.map((t, i) => {
      if (i === trackIndex && t.clip) {
        return {
          ...t,
          clip: {
            ...t.clip,
            original_duration_ms: durationMs,
            trim_end_ms: durationMs,
          },
        };
      }
      return t;
    });

    setCurrentMix({ ...mix, tracks: newTracks });
    setIsDirty(true);
    autoSave();
  };

  const reloadTracks = async () => {
    const mix = currentMix();
    const path = mixPath();
    if (mix && path) {
      await loadTracksIntoEngine(mix, path);
    }
  };

  const armTrack = (trackIndex: number | null) => {
    setArmedTrack(trackIndex);
  };

  return {
    // State
    currentMix,
    currentProject: currentMix, // Alias for backward compatibility
    mixPath,
    isDirty,
    selectedTrack,
    setSelectedTrack,
    armedTrack,
    armTrack,
    // Mix operations
    createMix,
    loadMix,
    saveMix,
    saveProject: saveMix, // Alias for backward compatibility
    // Track operations
    addTrack,
    removeTrack,
    addClipToTrack,
    updateTrackVolume,
    updateTrackMute,
    updateTrackSolo,
    updateClipDuration,
    setCurrentMix,
    reloadTracks,
  };
}

// Export alias for backward compatibility
export const useProjectStore = useMixStore;
