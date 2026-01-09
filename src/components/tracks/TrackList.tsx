import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Track } from "./Track";
import { useProjectStore } from "../../stores/projectStore";

const DEFAULT_TRACK_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export const TrackList: Component = () => {
  const store = useProjectStore();
  const [playheadPosition, setPlayheadPosition] = createSignal(0);
  const [maxDuration, setMaxDuration] = createSignal(60000); // Default 1 minute

  let positionInterval: number | undefined;

  onMount(() => {
    // Poll for playhead position
    positionInterval = window.setInterval(async () => {
      try {
        const pos = await invoke<number>("get_position");
        setPlayheadPosition(pos);
      } catch (e) {
        // Silently fail
      }
    }, 50);
  });

  onCleanup(() => {
    if (positionInterval) clearInterval(positionInterval);
  });

  // Calculate max duration from all clips
  const getMaxDuration = () => {
    const project = store.currentProject();
    if (!project) return 60000;

    let max = 0;
    for (const track of project.tracks) {
      if (track.clip) {
        max = Math.max(max, track.clip.original_duration_ms);
      }
    }
    return max > 0 ? max : 60000;
  };

  const handleSeek = async (normalizedPosition: number) => {
    const duration = getMaxDuration();
    const positionMs = Math.floor(normalizedPosition * duration);
    try {
      await invoke("seek", { positionMs });
      setPlayheadPosition(positionMs);
    } catch (e) {
      console.error("Failed to seek:", e);
    }
  };

  const handleTimelineClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalizedPosition = x / rect.width;
    handleSeek(Math.max(0, Math.min(1, normalizedPosition)));
  };

  // Default tracks when no project is loaded
  const defaultTracks = Array.from({ length: 8 }, (_, i) => ({
    id: `track-${i}`,
    index: i,
    name: `Track ${i + 1}`,
    color: DEFAULT_TRACK_COLORS[i],
    volume: 0.8,
    muted: false,
    solo: false,
    clip: null,
  }));

  const normalizedPlayhead = () => {
    const max = getMaxDuration();
    return max > 0 ? playheadPosition() / max : 0;
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div class="flex flex-col h-full">
      {/* Timeline header */}
      <div
        class="flex border-b border-border bg-bg-secondary shrink-0"
        style={{ height: "24px" }}
      >
        {/* Header spacer */}
        <div
          class="shrink-0 border-r border-border"
          style={{ width: "var(--track-header-width)" }}
        />

        {/* Timeline ruler */}
        <div
          class="flex-1 relative cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* Time markers */}
          <div class="absolute inset-0 flex items-center">
            {Array.from({ length: 7 }).map((_, i) => {
              const time = (i / 6) * getMaxDuration();
              return (
                <div
                  class="absolute flex flex-col items-center"
                  style={{ left: `${(i / 6) * 100}%` }}
                >
                  <div class="w-px h-2 bg-gray-600" />
                  <span class="text-[9px] text-gray-500 -translate-x-1/2">
                    {formatTime(time)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Playhead on timeline */}
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-white z-10"
            style={{ left: `${normalizedPlayhead() * 100}%` }}
          />
        </div>
      </div>

      {/* Track list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={store.currentProject()}
          fallback={
            <For each={defaultTracks}>
              {(track) => (
                <Track
                  index={track.index}
                  name={track.name}
                  color={track.color}
                  volume={track.volume}
                  muted={track.muted}
                  solo={track.solo}
                  clip={null}
                  isArmed={store.armedTrack() === track.index}
                  onArmToggle={() =>
                    store.armTrack(
                      store.armedTrack() === track.index ? null : track.index
                    )
                  }
                  onVolumeChange={() => {}}
                  onMuteToggle={() => {}}
                  onSoloToggle={() => {}}
                  onSeek={handleSeek}
                  playheadPosition={normalizedPlayhead()}
                />
              )}
            </For>
          }
        >
          <For each={store.currentProject()?.tracks}>
            {(track) => (
              <Track
                index={track.index}
                name={track.name}
                color={track.color}
                volume={track.volume}
                muted={track.muted}
                solo={track.solo}
                clip={track.clip}
                isArmed={store.armedTrack() === track.index}
                onArmToggle={() =>
                  store.armTrack(
                    store.armedTrack() === track.index ? null : track.index
                  )
                }
                onVolumeChange={(v) => store.updateTrackVolume(track.index, v)}
                onMuteToggle={() => store.updateTrackMute(track.index, !track.muted)}
                onSoloToggle={() => store.updateTrackSolo(track.index, !track.solo)}
                onSeek={handleSeek}
                playheadPosition={normalizedPlayhead()}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
