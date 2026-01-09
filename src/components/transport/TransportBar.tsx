import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useMixStore } from "../../stores/projectStore";

export const TransportBar: Component = () => {
  const store = useMixStore();
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [position, setPosition] = createSignal(0);
  const [inputLevel, setInputLevel] = createSignal(0);
  const [recordingFilename, setRecordingFilename] = createSignal<string | null>(
    null
  );

  let positionInterval: number | undefined;
  let levelInterval: number | undefined;

  onMount(() => {
    positionInterval = window.setInterval(async () => {
      if (isPlaying() || isRecording()) {
        try {
          const pos = await invoke<number>("get_position");
          setPosition(pos);
        } catch (e) {
          console.error("Failed to get position:", e);
        }
      }
    }, 50);

    levelInterval = window.setInterval(async () => {
      try {
        const level = await invoke<number>("get_input_level");
        setInputLevel(level);
      } catch (e) {}
    }, 50);
  });

  onCleanup(() => {
    if (positionInterval) clearInterval(positionInterval);
    if (levelInterval) clearInterval(levelInterval);
  });

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  const handlePlayStop = async () => {
    try {
      if (isPlaying()) {
        // Stop - also stops recording if active
        if (isRecording()) {
          await handleStopRecording();
        }
        await invoke("stop");
        setIsPlaying(false);
        setPosition(0);
      } else {
        // Play
        await invoke("play");
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Failed to play/stop:", e);
    }
  };

  const handleRecord = async () => {
    const trackIndex = store.selectedTrack();
    const path = store.mixPath();

    if (!store.currentMix()) {
      alert("Please create or open a mix first");
      return;
    }

    if (!path) {
      alert("Please create or open a mix first");
      return;
    }

    if (store.currentMix()!.tracks.length === 0) {
      alert("Please add a track first");
      return;
    }

    try {
      if (isRecording()) {
        await handleStopRecording();
        await invoke("stop");
        setIsPlaying(false);
        setPosition(0);
      } else {
        // Start recording
        const filename = await invoke<string>("start_recording", {
          trackIndex,
          projectPath: path,
        });
        setRecordingFilename(filename);
        setIsRecording(true);
        setIsPlaying(true);
        await invoke("play");
      }
    } catch (e) {
      console.error("Failed to record:", e);
      alert(`Recording failed: ${e}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      await invoke("stop_recording");
      setIsRecording(false);

      const filename = recordingFilename();
      const trackIndex = store.selectedTrack();
      const pos = position();

      if (filename && pos > 0) {
        await store.addClipToTrack(trackIndex, `audio/${filename}`, pos);
        await store.saveMix();
      }

      setRecordingFilename(null);
    } catch (e) {
      console.error("Failed to stop recording:", e);
    }
  };

  const levelToWidth = (level: number): number => {
    if (level <= 0) return 0;
    const db = 20 * Math.log10(level);
    const normalized = Math.max(0, (db + 60) / 60);
    return normalized * 100;
  };

  return (
    <div
      class="flex items-center justify-center gap-6 px-4 bg-bg-tertiary border-b border-border"
      style={{ height: "var(--transport-height)" }}
    >
      {/* Input level meter */}
      <div class="w-24 h-2 bg-bg-secondary rounded overflow-hidden">
        <div
          class={`h-full transition-all duration-75 ${inputLevel() > 0.8 ? "bg-red-500" : "bg-green-500"}`}
          style={{ width: `${levelToWidth(inputLevel())}%` }}
        />
      </div>

      {/* Time display */}
      <div class="w-32 text-center">
        <span
          class={`font-mono text-xl ${isRecording() ? "text-red-400" : "text-gray-200"}`}
        >
          {formatTime(position())}
        </span>
      </div>

      {/* Transport buttons */}
      <div class="flex items-center gap-2">
        {/* Play/Stop toggle */}
        <button
          onClick={handlePlayStop}
          class="w-12 h-12 flex items-center justify-center rounded-lg bg-accent-primary hover:bg-indigo-600 transition-colors"
          title={isPlaying() ? "Stop" : "Play"}
        >
          {isPlaying() ? (
            <svg
              class="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg
              class="w-5 h-5 text-white ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        {/* Record */}
        <button
          onClick={handleRecord}
          class={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            isRecording()
              ? "bg-red-600 hover:bg-red-700 animate-pulse"
              : store.currentMix()?.tracks.length
                ? "bg-red-900 hover:bg-red-800"
                : "bg-bg-secondary hover:bg-gray-700"
          }`}
          title={
            store.currentMix()?.tracks.length
              ? `Record to ${store.currentMix()?.tracks[store.selectedTrack()]?.name || "Track"}`
              : "Add a track first"
          }
        >
          <svg
            class={`w-4 h-4 ${isRecording() || store.currentMix()?.tracks.length ? "text-red-400" : "text-gray-500"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="6" />
          </svg>
        </button>
      </div>

      {/* Status */}
      <div class="w-32 text-center">
        <Show
          when={isRecording()}
          fallback={<span class="font-mono text-sm text-gray-500">Ready</span>}
        >
          <span class="font-mono text-sm text-red-400 animate-pulse">
            Recording...
          </span>
        </Show>
      </div>
    </div>
  );
};
