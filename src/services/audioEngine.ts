import { invoke } from "@tauri-apps/api/core";

export interface TrackInfo {
  audio_file: string | null;
  volume: number;
  muted: boolean;
}

// Transport controls
export const play = () => invoke("play").catch(() => {});
export const pause = () => invoke("pause").catch(() => {});
export const stop = async () => {
  await pause();
  await seek(0);
};
export const seek = (positionMs: number) => invoke("seek", { positionMs }).catch(() => {});
export const getPosition = () => invoke<number>("get_position");
export const isPlaying = () => invoke<boolean>("is_playing");

// Recording
export const startRecording = (trackIndex: number, projectPath: string) =>
  invoke<string>("start_recording", { trackIndex, projectPath });
export const stopRecording = () => invoke("stop_recording");
export const isRecording = () => invoke<boolean>("is_recording");
export const getInputLevel = () => invoke<number>("get_input_level");

// Audio engine state
export const isAudioAvailable = () => invoke<boolean>("is_audio_available");
export const loadTracks = (projectPath: string, tracks: TrackInfo[]) =>
  invoke("load_tracks", { projectPath, tracks }).catch(() => {});

// Audio editing
export const spliceRecording = (
  originalPath: string,
  newRecordingPath: string,
  startMs: number,
  outputPath: string,
) =>
  invoke<number>("splice_recording", {
    originalPath,
    newRecordingPath,
    startMs,
    outputPath,
  });

export const trimAudio = (inputPath: string, outputPath: string, startMs: number, endMs: number) =>
  invoke("trim_audio", { inputPath, outputPath, startMs, endMs });

// Export
export const exportMixToFile = (
  tracks: Array<{ path: string; volume: number; muted: boolean }>,
  outputPath: string,
  sampleRate: number,
) => invoke("export_mix_to_file", { tracks, outputPath, sampleRate });
