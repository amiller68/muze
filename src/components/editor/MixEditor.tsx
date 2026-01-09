import { Component, createSignal, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useMixStore } from "../../stores/projectStore";

interface MixEditorProps {
  onDone: () => void;
}

export const MixEditor: Component<MixEditorProps> = (props) => {
  const store = useMixStore();
  const [playheadMs, setPlayheadMs] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isRecording, setIsRecording] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [recordingFilename, setRecordingFilename] = createSignal<string | null>(null);
  const [recordingStartMs, setRecordingStartMs] = createSignal(0);
  const [existingClipPath, setExistingClipPath] = createSignal<string | null>(null);
  const [zoomLevel, setZoomLevel] = createSignal(1); // 1 = default, 0.5 = zoomed out, 2 = zoomed in
  const [viewMode, setViewMode] = createSignal<"single" | "overlay" | "stacked">("overlay");
  const [inputLevel, setInputLevel] = createSignal(0);
  const [recordingWaveform, setRecordingWaveform] = createSignal<number[]>([]);

  let waveformRef: HTMLDivElement | undefined;
  let positionInterval: number | undefined;
  let levelInterval: number | undefined;

  const MIN_TIMELINE_MS = 15000; // 15 seconds default

  // Track which mix is loaded to detect when a NEW mix is opened
  let lastMixId: string | null = null;

  // Reset playhead only when a DIFFERENT mix is loaded (not on every mix update)
  createEffect(() => {
    const mix = store.currentMix();
    if (mix && mix.id !== lastMixId) {
      lastMixId = mix.id;
      // Reset playhead to 0 when a new mix is loaded
      setPlayheadMs(0);
      setIsPlaying(false);
    }
  });

  onMount(() => {
    positionInterval = window.setInterval(async () => {
      try {
        const pos = await invoke<number>("get_position");
        setPlayheadMs(pos);
        // Stop playback when reaching end of content
        const contentDuration = getContentDuration();
        if (contentDuration > 0 && pos >= contentDuration && isPlaying() && !isRecording()) {
          await invoke("pause");
          setIsPlaying(false);
        }
      } catch (e) {}
    }, 30);

    // Poll input level for live waveform during recording
    levelInterval = window.setInterval(async () => {
      try {
        const level = await invoke<number>("get_input_level");
        setInputLevel(level);
        // Add to recording waveform when recording
        if (isRecording()) {
          setRecordingWaveform((prev) => [...prev.slice(-200), level]);
        }
      } catch (e) {}
    }, 50);
  });

  onCleanup(() => {
    if (positionInterval) clearInterval(positionInterval);
    if (levelInterval) clearInterval(levelInterval);
  });

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

  const getTimelineScale = () => {
    const base = Math.max(getContentDuration(), MIN_TIMELINE_MS);
    return base / zoomLevel();
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.5, 8));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.5, 0.25));

  // Handle wheel zoom
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  };

  // Pinch zoom state
  let lastTouchDistance = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (lastTouchDistance > 0) {
        const delta = distance - lastTouchDistance;
        if (Math.abs(delta) > 5) {
          if (delta > 0) {
            setZoomLevel((z) => Math.min(z * 1.05, 8));
          } else {
            setZoomLevel((z) => Math.max(z / 1.05, 0.25));
          }
          lastTouchDistance = distance;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance = 0;
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  };

  const formatTimeShort = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const playheadPercent = () => {
    const scale = getTimelineScale();
    return scale > 0 ? (playheadMs() / scale) * 100 : 0;
  };

  const handleSeek = async (e: MouseEvent) => {
    if (!waveformRef) return;
    const rect = waveformRef.getBoundingClientRect();
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

  const handlePlayStop = async () => {
    try {
      if (isPlaying()) {
        if (isRecording()) {
          await handleStopRecording();
        }
        await invoke("pause");
        setIsPlaying(false);
        // Keep playhead where it is - don't reset
      } else {
        await invoke("play");
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Play/stop failed:", e);
    }
  };

  const handleSkip = async (deltaMs: number) => {
    const maxPos = getContentDuration();
    const newPos = Math.max(0, Math.min(maxPos, playheadMs() + deltaMs));
    try {
      await invoke("seek", { positionMs: newPos });
      setPlayheadMs(newPos);
    } catch (e) {
      console.error("Skip failed:", e);
    }
  };

  const handleRecord = async () => {
    const mix = store.currentMix();
    const path = store.mixPath();
    if (!mix || !path) {
      console.error("No mix or path");
      return;
    }

    try {
      if (isRecording()) {
        await handleStopRecording();
        await invoke("pause");
        setIsPlaying(false);
      } else {
        // Add track if none exist
        if (mix.tracks.length === 0) {
          store.addTrack();
          await store.saveMix(); // Save so audio folder exists
        }

        const trackIndex = store.selectedTrack();
        const track = mix.tracks[trackIndex];
        console.log("Starting recording on track", trackIndex, "path", path);
        console.log("Track data:", track);
        console.log("Track clip:", track?.clip);

        // Clear recording waveform and save start position
        setRecordingWaveform([]);
        // Get position directly from engine to avoid any signal sync issues
        const currentPlayhead = await invoke<number>("get_position");
        console.log("Capturing playhead position for recording (from engine):", currentPlayhead);
        setRecordingStartMs(currentPlayhead);

        // If track has existing clip, save its path for splice operation
        if (track?.clip) {
          const clipPath = `${path}/${track.clip.audio_file}`;
          console.log("Setting existingClipPath for REPLACE mode:", clipPath);
          setExistingClipPath(clipPath);
          // Mute the track so we don't hear old audio while recording
          store.updateTrackMute(trackIndex, true);
          await store.reloadTracks();
          // Seek back to captured position after reload
          await invoke("seek", { positionMs: currentPlayhead });
        } else {
          console.log("No existing clip - will be NEW recording");
          setExistingClipPath(null);
        }

        const filename = await invoke<string>("start_recording", {
          trackIndex,
          projectPath: path,
        });
        console.log("Recording started, filename:", filename);

        setRecordingFilename(filename);
        setIsRecording(true);
        setIsPlaying(true);
        await invoke("play");
      }
    } catch (e) {
      console.error("Record failed:", e);
      alert(`Recording failed: ${e}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      await invoke("stop_recording");
      setIsRecording(false);

      const filename = recordingFilename();
      const trackIndex = store.selectedTrack();
      const path = store.mixPath();
      const startMs = recordingStartMs();
      const existingPath = existingClipPath();
      const recordingDuration = playheadMs() - startMs;

      console.log("Stop recording - filename:", filename, "track:", trackIndex, "startMs:", startMs, "recordingDuration:", recordingDuration);

      if (filename && recordingDuration > 0 && path) {
        const newRecordingPath = `${path}/audio/${filename}`;

        if (existingPath) {
          // REPLACE mode: Splice new recording into existing audio
          console.log("Splicing into existing clip at", existingPath);
          const newDuration = await invoke<number>("splice_recording", {
            originalPath: existingPath,
            newRecordingPath: newRecordingPath,
            startMs: startMs,
            outputPath: existingPath, // Overwrite original
          });
          console.log("Splice complete, new duration:", newDuration);

          // Pause playback before reloading to avoid audio glitches
          await invoke("pause").catch(() => {});

          // Unmute the track now that we're done recording
          store.updateTrackMute(trackIndex, false);

          // Update clip with new duration
          await store.updateClipDuration(trackIndex, newDuration);
          await store.saveMix();

          // Reload the audio into the engine so it plays the new spliced audio
          await store.reloadTracks();
          console.log("Tracks reloaded into engine");
        } else {
          // NEW recording: Add as new clip
          await store.addClipToTrack(trackIndex, `audio/${filename}`, recordingDuration);
          await store.saveMix();
          console.log("New clip added and saved");
        }
      } else {
        console.log("No clip to add - filename:", filename, "duration:", recordingDuration);
      }

      setRecordingFilename(null);
      setExistingClipPath(null);
    } catch (e) {
      console.error("Stop recording failed:", e);
      alert(`Stop recording failed: ${e}`);
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

  // Auto-stop playback when reaching end of content
  const checkPlaybackEnd = () => {
    const contentDuration = getContentDuration();
    if (contentDuration > 0 && playheadMs() >= contentDuration && isPlaying() && !isRecording()) {
      invoke("pause").catch(console.error);
      setIsPlaying(false);
    }
  };

  const currentTrack = () => {
    const mix = store.currentMix();
    if (!mix || mix.tracks.length === 0) return null;
    return mix.tracks[store.selectedTrack()];
  };

  return (
    <div class="h-full flex flex-col bg-black text-white">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => setShowSettings(true)}
          class="w-10 h-10 flex items-center justify-center text-blue-500"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
        <div class="text-center">
          <div class="font-semibold">{store.currentMix()?.name || "New Mix"}</div>
          <div class="text-xs text-gray-500">
            {store.currentMix()?.tracks.length || 0} tracks
          </div>
        </div>
        {/* View mode toggle */}
        <button
          onClick={() => {
            const modes: Array<"single" | "overlay" | "stacked"> = ["single", "overlay", "stacked"];
            const current = modes.indexOf(viewMode());
            setViewMode(modes[(current + 1) % 3]);
          }}
          class="w-10 h-10 flex items-center justify-center text-blue-500"
          title={`View: ${viewMode()}`}
        >
          {viewMode() === "single" && (
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="8" width="16" height="8" rx="1" stroke-width="2"/>
            </svg>
          )}
          {viewMode() === "overlay" && (
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="6" width="16" height="6" rx="1" stroke-width="2"/>
              <rect x="4" y="12" width="16" height="6" rx="1" stroke-width="2" opacity="0.5"/>
            </svg>
          )}
          {viewMode() === "stacked" && (
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="4" rx="1" stroke-width="1.5"/>
              <rect x="4" y="10" width="16" height="4" rx="1" stroke-width="1.5"/>
              <rect x="4" y="16" width="16" height="4" rx="1" stroke-width="1.5"/>
            </svg>
          )}
        </button>
      </div>

      {/* Waveform Area */}
      <div
        ref={waveformRef}
        class="flex-1 relative bg-gray-900 cursor-pointer min-h-[200px]"
        onClick={handleSeek}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Show
          when={store.currentMix()?.tracks.some((t) => t.clip)}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-gray-600">Tap record to start</span>
              <span class="text-gray-700 text-xs ml-2">(tracks: {store.currentMix()?.tracks.length || 0})</span>
            </div>
          }
        >
          {/* Single mode - only selected track */}
          <Show when={viewMode() === "single" && !isRecording()}>
            {(() => {
              const track = store.currentMix()?.tracks[store.selectedTrack()];
              if (!track?.clip) return null;
              const clip = track.clip;
              const durationSec = clip.original_duration_ms / 1000;
              const barCount = Math.max(20, Math.min(200, Math.floor(durationSec * 10)));
              const bars = generateWaveform(clip.id, barCount);
              const clipWidth = (clip.original_duration_ms / getTimelineScale()) * 100;
              return (
                <div
                  class="absolute top-0 bottom-0 left-0"
                  style={{ width: `${Math.max(clipWidth, 5)}%`, opacity: track.muted ? 0.3 : 1 }}
                >
                  <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <For each={bars}>
                      {(height, idx) => {
                        const barHeight = Math.max(height * 40, 2);
                        const x = (idx() / bars.length) * 100;
                        const barW = 100 / bars.length * 0.6;
                        return (
                          <rect
                            x={x}
                            y={50 - barHeight}
                            width={barW}
                            height={barHeight * 2}
                            rx="0.5"
                            fill={track.color}
                          />
                        );
                      }}
                    </For>
                  </svg>
                </div>
              );
            })()}
          </Show>

          {/* Overlay mode - all tracks overlaid, selected dominant */}
          <Show when={viewMode() === "overlay"}>
            <For each={store.currentMix()?.tracks}>
              {(track, i) => {
                // Hide the selected track's clip waveform while recording (we show live waveform instead)
                const isSelectedAndRecording = () => i() === store.selectedTrack() && isRecording();
                if (!track.clip || isSelectedAndRecording()) return null;
                const clip = track.clip;
                const isSelected = i() === store.selectedTrack();
                const durationSec = clip.original_duration_ms / 1000;
                const barCount = Math.max(20, Math.min(200, Math.floor(durationSec * 10)));
                const bars = generateWaveform(clip.id, barCount);
                const clipWidth = (clip.original_duration_ms / getTimelineScale()) * 100;
                return (
                  <div
                    class="absolute top-0 bottom-0 left-0"
                    style={{
                      width: `${Math.max(clipWidth, 5)}%`,
                      opacity: track.muted ? 0.15 : isSelected ? 0.9 : 0.4,
                      "z-index": isSelected ? 5 : 1,
                    }}
                  >
                    <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <For each={bars}>
                        {(height, idx) => {
                          const barHeight = Math.max(height * 40, 2);
                          const x = (idx() / bars.length) * 100;
                          const barW = 100 / bars.length * 0.6;
                          return (
                            <rect
                              x={x}
                              y={50 - barHeight}
                              width={barW}
                              height={barHeight * 2}
                              rx="0.5"
                              fill={track.color}
                            />
                          );
                        }}
                      </For>
                    </svg>
                  </div>
                );
              }}
            </For>
          </Show>

          {/* Stacked mode - tracks vertically stacked */}
          <Show when={viewMode() === "stacked"}>
            <div class="absolute inset-0 flex flex-col">
              <For each={store.currentMix()?.tracks}>
                {(track, i) => {
                  const isSelected = i() === store.selectedTrack();
                  const isSelectedAndRecording = () => isSelected && isRecording();
                  const clip = track.clip;
                  return (
                    <div
                      class="flex-1 relative border-b border-gray-800 last:border-b-0"
                      style={{ "background-color": isSelected ? "rgba(255,255,255,0.03)" : "transparent" }}
                    >
                      {clip && !isSelectedAndRecording() && (() => {
                        const durationSec = clip.original_duration_ms / 1000;
                        const barCount = Math.max(20, Math.min(200, Math.floor(durationSec * 10)));
                        const bars = generateWaveform(clip.id, barCount);
                        const clipWidth = (clip.original_duration_ms / getTimelineScale()) * 100;
                        return (
                          <div
                            class="absolute top-0 bottom-0 left-0"
                            style={{
                              width: `${Math.max(clipWidth, 5)}%`,
                              opacity: track.muted ? 0.2 : 0.8,
                            }}
                          >
                            <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <For each={bars}>
                                {(height, idx) => {
                                  const barHeight = Math.max(height * 40, 3);
                                  const x = (idx() / bars.length) * 100;
                                  const barW = 100 / bars.length * 0.6;
                                  return (
                                    <rect
                                      x={x}
                                      y={50 - barHeight}
                                      width={barW}
                                      height={barHeight * 2}
                                      rx="0.5"
                                      fill={track.color}
                                    />
                                  );
                                }}
                              </For>
                            </svg>
                          </div>
                        );
                      })()}
                      {/* Track label */}
                      <div
                        class="absolute top-1 left-1 text-[9px] px-1 rounded"
                        style={{ "background-color": track.color, opacity: 0.7 }}
                      >
                        {track.name}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>

        {/* Live recording waveform - matches saved waveform style exactly */}
        <Show when={isRecording()}>
          {(() => {
            const track = store.currentMix()?.tracks[store.selectedTrack()];
            const waveform = recordingWaveform();
            const startPct = (recordingStartMs() / getTimelineScale()) * 100;
            const currentPct = (playheadMs() / getTimelineScale()) * 100;
            const recWidth = Math.max(currentPct - startPct, 1);
            const color = track?.color || "#ef4444";

            // Calculate bar count same way as saved waveform: 10 bars per second
            const recordingDurationSec = (playheadMs() - recordingStartMs()) / 1000;
            const targetBarCount = Math.max(20, Math.min(200, Math.floor(recordingDurationSec * 10)));

            // Resample waveform to match target bar count
            const rawBars = waveform;
            const displayBars: number[] = [];
            if (rawBars.length > 0) {
              const step = Math.max(1, rawBars.length / targetBarCount);
              for (let i = 0; i < targetBarCount && i * step < rawBars.length; i++) {
                const idx = Math.floor(i * step);
                displayBars.push(rawBars[idx]);
              }
            }

            const barCount = displayBars.length || 1;
            return (
              <div
                class="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${startPct}%`,
                  width: `${recWidth}%`,
                  opacity: 0.9,
                  "z-index": 5,
                }}
              >
                <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <For each={displayBars}>
                    {(level, idx) => {
                      // Amplify input level to match saved waveform visual scale
                      const amplified = Math.min(1, level * 4);
                      const barHeight = Math.max(amplified * 40, 2);
                      const x = (idx() / barCount) * 100;
                      const barW = 100 / barCount * 0.6;
                      return (
                        <rect
                          x={x}
                          y={50 - barHeight}
                          width={barW}
                          height={barHeight * 2}
                          rx="0.5"
                          fill={color}
                        />
                      );
                    }}
                  </For>
                </svg>
              </div>
            );
          })()}
        </Show>

        {/* Playhead */}
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-blue-500 pointer-events-none z-10"
          style={{ left: `${playheadPercent()}%` }}
        >
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-500" />
        </div>

        {/* Zoom controls */}
        <div class="absolute bottom-2 right-2 flex items-center gap-1 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
            class="w-7 h-7 rounded bg-gray-800/80 text-white flex items-center justify-center text-sm"
          >
            -
          </button>
          <span class="text-[10px] text-gray-400 w-10 text-center">
            {Math.round(zoomLevel() * 100)}%
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            class="w-7 h-7 rounded bg-gray-800/80 text-white flex items-center justify-center text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div class="h-6 flex items-center justify-between px-4 text-xs text-gray-500 bg-gray-900 border-t border-gray-800">
        <For each={[0, 0.25, 0.5, 0.75, 1]}>
          {(pct) => <span>{formatTimeShort(pct * getTimelineScale())}</span>}
        </For>
      </div>

      {/* Time Display */}
      <div class="py-6 text-center bg-black">
        <span
          class={`font-mono text-5xl font-light ${isRecording() ? "text-red-500" : "text-white"}`}
        >
          {formatTime(playheadMs())}
        </span>
      </div>

      {/* Transport */}
      <div class="flex items-center justify-center gap-8 py-4 bg-black">
        <button
          onClick={() => handleSkip(-15000)}
          class="w-12 h-12 flex items-center justify-center text-white"
        >
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <text x="9" y="14" font-size="6" font-weight="bold">15</text>
          </svg>
        </button>

        <button
          onClick={handlePlayStop}
          class="w-16 h-16 flex items-center justify-center rounded-full bg-white"
        >
          {isPlaying() ? (
            <svg class="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg class="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => handleSkip(15000)}
          class="w-12 h-12 flex items-center justify-center text-white"
        >
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
            <text x="9" y="14" font-size="6" font-weight="bold">15</text>
          </svg>
        </button>
      </div>

      {/* Bottom Bar */}
      <div class="flex items-center justify-between px-4 py-4 bg-black border-t border-gray-800">
        <div class="w-16" />

        <button
          onClick={handleRecord}
          class={`px-8 py-3 rounded-full font-semibold text-lg ${
            isRecording()
              ? "bg-red-600 text-white animate-pulse"
              : "bg-red-500 text-white"
          }`}
        >
          {isRecording() ? "STOP" : currentTrack()?.clip ? "REPLACE" : "RECORD"}
        </button>

        <button
          onClick={async () => {
            console.log("Done button clicked");
            try {
              // Stop playback first if playing
              if (isPlaying()) {
                await invoke("pause");
                setIsPlaying(false);
              }
              if (isRecording()) {
                await handleStopRecording();
              }
              props.onDone();
            } catch (e) {
              console.error("Done button error:", e);
              props.onDone();
            }
          }}
          class="text-blue-500 font-semibold"
        >
          Done
        </button>
      </div>

      {/* Track Dots */}
      <Show when={store.currentMix()?.tracks.length}>
        <div class="flex items-center justify-center gap-2 pb-4 bg-black">
          <For each={store.currentMix()?.tracks}>
            {(track, i) => (
              <button
                onClick={() => store.setSelectedTrack(i())}
                class={`w-2 h-2 rounded-full transition-all ${
                  store.selectedTrack() === i()
                    ? "w-3 h-3"
                    : "opacity-50"
                }`}
                style={{ "background-color": track.color }}
                title={track.name}
              />
            )}
          </For>
          <Show when={(store.currentMix()?.tracks.length || 0) < 8}>
            <button
              onClick={() => store.addTrack()}
              class="w-6 h-6 rounded-full border border-gray-600 text-gray-600 flex items-center justify-center text-sm"
            >
              +
            </button>
          </Show>
        </div>
      </Show>

      {/* Settings Modal */}
      <Show when={showSettings()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div class="bg-gray-900 rounded-t-2xl w-full max-w-md p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-semibold">Track Settings</h2>
              <button onClick={() => setShowSettings(false)} class="text-blue-500">
                Done
              </button>
            </div>

            <div class="space-y-4">
              <For each={store.currentMix()?.tracks}>
                {(track, i) => (
                  <div class="flex items-center gap-3">
                    <div
                      class="w-3 h-3 rounded-full shrink-0"
                      style={{ "background-color": track.color }}
                    />
                    <span class="w-16 text-sm truncate">{track.name}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume}
                      onInput={(e) =>
                        store.updateTrackVolume(i(), parseFloat(e.currentTarget.value))
                      }
                      class="flex-1"
                    />
                    <button
                      onClick={() => store.updateTrackSolo(i(), !track.solo)}
                      class={`w-8 h-8 rounded text-xs font-bold ${
                        track.solo ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"
                      }`}
                      title="Solo - isolate this track"
                    >
                      S
                    </button>
                    <button
                      onClick={() => store.updateTrackMute(i(), !track.muted)}
                      class={`w-8 h-8 rounded text-xs font-bold ${
                        track.muted ? "bg-yellow-500 text-black" : "bg-gray-700 text-gray-400"
                      }`}
                      title="Mute this track"
                    >
                      M
                    </button>
                    <button
                      onClick={() => {
                        if ((store.currentMix()?.tracks.length || 0) > 1) {
                          store.removeTrack(i());
                        }
                      }}
                      class={`w-8 h-8 rounded text-xs font-bold ${
                        (store.currentMix()?.tracks.length || 0) > 1
                          ? "bg-red-900 text-red-400 hover:bg-red-800"
                          : "bg-gray-800 text-gray-600 cursor-not-allowed"
                      }`}
                      disabled={(store.currentMix()?.tracks.length || 0) <= 1}
                      title={(store.currentMix()?.tracks.length || 0) <= 1 ? "Can't delete last track" : "Delete track"}
                    >
                      X
                    </button>
                  </div>
                )}
              </For>
            </div>

            <Show when={(store.currentMix()?.tracks.length || 0) < 8}>
              <button
                onClick={() => store.addTrack()}
                class="mt-6 w-full py-3 rounded-lg bg-gray-800 text-white"
              >
                Add Track
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
