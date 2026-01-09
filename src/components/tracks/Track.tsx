import { Component, Show } from "solid-js";
import type { Clip } from "../../types/project";

interface TrackProps {
  index: number;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  clip: Clip | null;
  isArmed: boolean;
  onArmToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onSeek?: (normalizedPosition: number) => void;
  playheadPosition?: number; // 0-1 normalized
}

export const Track: Component<TrackProps> = (props) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleWaveformClick = (e: MouseEvent) => {
    if (!props.clip || !props.onSeek) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalizedPosition = x / rect.width;
    props.onSeek(Math.max(0, Math.min(1, normalizedPosition)));
  };

  // Generate deterministic waveform data based on clip id
  const generateWaveformBars = (clipId: string, count: number) => {
    const bars: number[] = [];
    let seed = 0;
    for (let i = 0; i < clipId.length; i++) {
      seed += clipId.charCodeAt(i);
    }
    for (let i = 0; i < count; i++) {
      // Seeded pseudo-random for consistent appearance
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const random = (seed % 1000) / 1000;
      // Create a more natural waveform shape
      const envelope = Math.sin((i / count) * Math.PI) * 0.3 + 0.4;
      const variation = random * 0.5;
      bars.push(Math.min(1, envelope + variation));
    }
    return bars;
  };

  return (
    <div
      class={`flex border-b border-border ${props.isArmed ? "bg-red-950/20" : ""}`}
      style={{ height: "var(--track-height)" }}
    >
      {/* Track header */}
      <div
        class="flex flex-col justify-center px-3 py-2 bg-bg-secondary border-r border-border shrink-0"
        style={{ width: "var(--track-header-width)" }}
      >
        {/* Track name with color indicator */}
        <div class="flex items-center gap-2 mb-2">
          <div
            class="w-2 h-2 rounded-full"
            style={{ "background-color": props.color }}
          />
          <span class="text-xs font-medium text-gray-300 truncate">
            {props.name}
          </span>
        </div>

        {/* Controls row */}
        <div class="flex items-center gap-1">
          {/* Mute button */}
          <button
            onClick={props.onMuteToggle}
            class={`w-5 h-5 text-[10px] font-semibold rounded transition-colors ${
              props.muted
                ? "bg-yellow-500/80 text-black"
                : "bg-bg-tertiary text-gray-500 hover:text-gray-300"
            }`}
            title="Mute"
          >
            M
          </button>

          {/* Solo button */}
          <button
            onClick={props.onSoloToggle}
            class={`w-5 h-5 text-[10px] font-semibold rounded transition-colors ${
              props.solo
                ? "bg-blue-500/80 text-white"
                : "bg-bg-tertiary text-gray-500 hover:text-gray-300"
            }`}
            title="Solo"
          >
            S
          </button>

          {/* Record arm button */}
          <button
            onClick={props.onArmToggle}
            class={`w-5 h-5 text-[10px] font-semibold rounded transition-colors ${
              props.isArmed
                ? "bg-red-500 text-white"
                : "bg-bg-tertiary text-gray-500 hover:text-gray-300"
            }`}
            title="Arm for recording"
          >
            R
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={props.volume}
            onInput={(e) =>
              props.onVolumeChange(parseFloat(e.currentTarget.value))
            }
            class="w-12 h-1 ml-1 accent-gray-500"
            title={`${Math.round(props.volume * 100)}%`}
          />
        </div>
      </div>

      {/* Waveform area */}
      <div
        class="flex-1 flex items-center bg-bg-primary relative overflow-hidden cursor-pointer"
        onClick={handleWaveformClick}
      >
        <Show
          when={props.clip}
          fallback={
            <div class="w-full h-full flex items-center justify-center">
              <span class="text-xs text-gray-600">
                {props.isArmed ? "Armed" : ""}
              </span>
            </div>
          }
        >
          {(clip) => {
            const bars = generateWaveformBars(clip().id, 200);
            return (
              <div class="w-full h-full relative">
                {/* Waveform */}
                <div class="absolute inset-0 flex items-center px-1">
                  <div class="w-full h-4/5 flex items-center justify-center gap-px">
                    {bars.map((height, i) => (
                      <div
                        class="h-full flex items-center"
                        style={{ width: "1px" }}
                      >
                        <div
                          class="w-full rounded-full"
                          style={{
                            height: `${height * 100}%`,
                            "background-color": props.color,
                            opacity: props.muted ? 0.3 : 0.7,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Playhead */}
                <Show when={props.playheadPosition !== undefined}>
                  <div
                    class="absolute top-0 bottom-0 w-px bg-white z-10"
                    style={{ left: `${(props.playheadPosition || 0) * 100}%` }}
                  />
                </Show>

                {/* Clip info overlay */}
                <div class="absolute bottom-1 left-2 right-2 flex justify-between items-center pointer-events-none">
                  <span class="text-[10px] text-gray-500 truncate max-w-24 bg-bg-primary/80 px-1 rounded">
                    {clip().audio_file.split("/").pop()?.replace(".wav", "")}
                  </span>
                  <span class="text-[10px] text-gray-500 bg-bg-primary/80 px-1 rounded">
                    {formatDuration(clip().original_duration_ms)}
                  </span>
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </div>
  );
};
