import { Component, For, Show } from "solid-js";
import { useMixStore } from "../../stores/projectStore";

export const TrackSelector: Component = () => {
  const store = useMixStore();

  return (
    <div class="w-48 bg-bg-secondary border-l border-border flex flex-col shrink-0">
      {/* Header */}
      <div class="h-6 flex items-center justify-between px-3 border-b border-border">
        <span class="text-[10px] text-gray-500 uppercase tracking-wide">Tracks</span>
        <Show when={store.currentMix()}>
          <button
            onClick={() => store.addTrack()}
            class="text-[10px] text-gray-400 hover:text-white transition-colors"
            title="Add track"
          >
            + Add
          </button>
        </Show>
      </div>

      {/* Track list */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={store.currentMix()}
          fallback={
            <div class="p-3 text-xs text-gray-600">No mix open</div>
          }
        >
          <For each={store.currentMix()?.tracks}>
            {(track, i) => (
              <div
                class={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border/50 transition-colors ${
                  store.selectedTrack() === i()
                    ? "bg-bg-tertiary"
                    : "hover:bg-bg-tertiary/50"
                }`}
                onClick={() => store.setSelectedTrack(i())}
              >
                {/* Color dot */}
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  style={{ "background-color": track.color }}
                />

                {/* Track name */}
                <span class="text-xs text-gray-300 flex-1 truncate">
                  {track.name}
                </span>

                {/* Recording indicator */}
                <Show when={store.selectedTrack() === i()}>
                  <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </Show>

                {/* Mute button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    store.updateTrackMute(i(), !track.muted);
                  }}
                  class={`w-4 h-4 text-[8px] font-bold rounded ${
                    track.muted
                      ? "bg-yellow-500 text-black"
                      : "bg-bg-primary text-gray-500"
                  }`}
                  title={track.muted ? "Unmute" : "Mute"}
                >
                  M
                </button>

                {/* Has clip indicator */}
                <Show when={track.clip}>
                  <div class="w-1 h-3 rounded-full bg-gray-500" title="Has audio" />
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Volume control for selected track */}
      <Show when={store.currentMix() && store.currentMix()!.tracks.length > 0}>
        <div class="p-3 border-t border-border">
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500">Vol</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={store.currentMix()?.tracks[store.selectedTrack()]?.volume || 0.8}
              onInput={(e) =>
                store.updateTrackVolume(
                  store.selectedTrack(),
                  parseFloat(e.currentTarget.value)
                )
              }
              class="flex-1 h-1 accent-gray-400"
            />
            <span class="text-[10px] text-gray-400 w-6">
              {Math.round(
                (store.currentMix()?.tracks[store.selectedTrack()]?.volume || 0.8) * 100
              )}
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
};
