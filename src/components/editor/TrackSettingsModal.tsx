import { type Component, For, Show } from "solid-js";
import { TRACK_LIMIT } from "../../constants/config";
import type { Mix } from "../../types/mix";

interface TrackSettingsModalProps {
  mix: Mix | null;
  onClose: () => void;
  onUpdateVolume: (trackIndex: number, volume: number) => void;
  onUpdateSolo: (trackIndex: number, solo: boolean) => void;
  onUpdateMute: (trackIndex: number, muted: boolean) => void;
  onRemoveTrack: (trackIndex: number) => void;
  onAddTrack: () => void;
}

export const TrackSettingsModal: Component<TrackSettingsModalProps> = (props) => {
  return (
    <div class="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      <div class="bg-neutral-900 rounded-t-2xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Track Settings</h2>
          <button onClick={props.onClose} class="text-neutral-400">
            Done
          </button>
        </div>

        <div class="space-y-4">
          <For each={props.mix?.tracks}>
            {(track, i) => (
              <div class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs text-white font-bold"
                  style={{ "background-color": track.color }}
                >
                  {i() + 1}
                </div>
                <span class="w-16 text-sm truncate">{track.name}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onInput={(e) => props.onUpdateVolume(i(), parseFloat(e.currentTarget.value))}
                  class="flex-1"
                />
                <button
                  onClick={() => props.onUpdateSolo(i(), !track.solo)}
                  class={`w-8 h-8 rounded text-xs font-bold ${
                    track.solo ? "bg-white text-black" : "bg-neutral-700 text-neutral-500"
                  }`}
                  title="Solo - isolate this track"
                >
                  S
                </button>
                <button
                  onClick={() => props.onUpdateMute(i(), !track.muted)}
                  class={`w-8 h-8 rounded text-xs font-bold ${
                    track.muted ? "bg-selection text-black" : "bg-neutral-700 text-neutral-500"
                  }`}
                  title="Mute this track"
                >
                  M
                </button>
                <button
                  onClick={() => {
                    if ((props.mix?.tracks.length || 0) > 1) {
                      props.onRemoveTrack(i());
                    }
                  }}
                  class={`w-8 h-8 rounded text-xs font-bold ${
                    (props.mix?.tracks.length || 0) > 1
                      ? "bg-neutral-800 text-destructive"
                      : "bg-neutral-800 text-neutral-700 cursor-not-allowed"
                  }`}
                  disabled={(props.mix?.tracks.length || 0) <= 1}
                  title={
                    (props.mix?.tracks.length || 0) <= 1
                      ? "Can't delete last track"
                      : "Delete track"
                  }
                >
                  X
                </button>
              </div>
            )}
          </For>
        </div>

        <Show when={(props.mix?.tracks.length || 0) < TRACK_LIMIT}>
          <button
            onClick={props.onAddTrack}
            class="mt-6 w-full py-3 rounded-lg bg-neutral-800 text-white"
          >
            Add Track
          </button>
        </Show>
      </div>
    </div>
  );
};
