import { Component, For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useMixStore } from "../../stores/projectStore";

export const WaveformView: Component = () => {
  const store = useMixStore();
  const [playheadMs, setPlayheadMs] = createSignal(0);
  let containerRef: HTMLDivElement | undefined;
  let positionInterval: number | undefined;

  onMount(() => {
    positionInterval = window.setInterval(async () => {
      try {
        const pos = await invoke<number>("get_position");
        setPlayheadMs(pos);
      } catch (e) {}
    }, 30);
  });

  onCleanup(() => {
    if (positionInterval) clearInterval(positionInterval);
  });

  const MIN_TIMELINE_MS = 60000; // Always show at least 60 seconds

  const getContentDuration = () => {
    const mix = store.currentMix();
    if (!mix) return 0;
    let max = 0;
    for (const track of mix.tracks) {
      if (track.clip) {
        max = Math.max(max, track.clip.original_duration_ms);
      }
    }
    return max;
  };

  // Timeline scale - always at least 60s to prevent jarring jumps
  const getTimelineScale = () => {
    return Math.max(getContentDuration(), MIN_TIMELINE_MS);
  };

  const handleClick = async (e: MouseEvent) => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalized = x / rect.width;
    const positionMs = Math.floor(normalized * getTimelineScale());
    try {
      await invoke("seek", { positionMs });
      setPlayheadMs(positionMs);
    } catch (e) {
      console.error("Seek failed:", e);
    }
  };

  const generateWaveform = (seed: string | undefined, count: number): number[] => {
    const bars: number[] = [];
    let s = 0;
    const seedStr = seed || "default";
    for (let i = 0; i < seedStr.length; i++) s += seedStr.charCodeAt(i);
    for (let i = 0; i < count; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const r = (s % 1000) / 1000;
      const env = Math.sin((i / count) * Math.PI) * 0.3 + 0.3;
      bars.push(Math.min(1, env + r * 0.6));
    }
    return bars;
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const playheadPercent = () => {
    const max = getTimelineScale();
    return max > 0 ? (playheadMs() / max) * 100 : 0;
  };

  return (
    <div class="flex-1 flex flex-col bg-bg-primary border-r border-border">
      {/* Timeline ruler */}
      <div
        class="h-6 border-b border-border relative cursor-pointer shrink-0"
        onClick={handleClick}
        ref={containerRef}
      >
        <For each={Array.from({ length: 11 })}>
          {(_, i) => (
            <div
              class="absolute top-0 flex flex-col items-center"
              style={{ left: `${(i() / 10) * 100}%` }}
            >
              <div class="w-px h-2 bg-gray-600" />
              <span class="text-[8px] text-gray-500 -translate-x-1/2">
                {formatTime((i() / 10) * getTimelineScale())}
              </span>
            </div>
          )}
        </For>
        {/* Playhead marker */}
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-white"
          style={{ left: `${playheadPercent()}%` }}
        />
      </div>

      {/* Waveform area */}
      <div
        class="flex-1 relative cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        <Show
          when={store.currentMix()?.tracks.some((t) => t.clip)}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-gray-600 text-sm">
                {store.currentMix() ? "Record to add audio" : "Create or open a mix"}
              </span>
            </div>
          }
        >
          {/* Overlaid waveforms */}
          <For each={store.currentMix()?.tracks}>
            {(track) => (
              <Show when={track.clip}>
                {(clip) => {
                  const bars = generateWaveform(clip().id, 400);
                  const clipWidth = (clip().original_duration_ms / getTimelineScale()) * 100;
                  return (
                    <div
                      class="absolute top-0 bottom-0 left-0 flex items-center"
                      style={{
                        width: `${clipWidth}%`,
                        opacity: track.muted ? 0.2 : 0.6,
                      }}
                    >
                      <div class="w-full h-full flex items-center px-1">
                        <For each={bars}>
                          {(height) => (
                            <div
                              class="flex-1 flex items-center justify-center"
                              style={{ height: "100%" }}
                            >
                              <div
                                class="w-px rounded-full"
                                style={{
                                  height: `${height * 80}%`,
                                  "background-color": track.color,
                                }}
                              />
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  );
                }}
              </Show>
            )}
          </For>
        </Show>

        {/* Playhead line */}
        <div
          class="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-10"
          style={{ left: `${playheadPercent()}%` }}
        />
      </div>
    </div>
  );
};
