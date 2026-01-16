import { invoke } from "@tauri-apps/api/core";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  LEVEL_POLL_MS,
  MIN_TIMELINE_MS,
  PINCH_ZOOM_FACTOR,
  POSITION_POLL_MS,
  SKIP_DELTA_MS,
  ZOOM_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
} from "../../constants/config";
import { useMixStore } from "../../stores/mixStore";
import type { Clip } from "../../types/mix";
import { TrackSettingsModal } from "./TrackSettingsModal";
import { BAR_UNIT_PX, Waveform } from "./Waveform";

interface MixEditorProps {
  onDone: () => void;
  inline?: boolean; // When true, renders as flex child instead of fixed overlay (for desktop)
  breadcrumb?: string; // Parent name for mobile breadcrumb navigation (e.g., "Projects", "My Album")
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
  const [_inputLevel, setInputLevel] = createSignal(0);
  const [recordingWaveform, setRecordingWaveform] = createSignal<number[]>([]);
  const [audioError, setAudioError] = createSignal<string | null>(null);
  const [trimMode, setTrimMode] = createSignal(false);
  const [trimStart, setTrimStart] = createSignal(0);
  const [trimEnd, setTrimEnd] = createSignal(0);
  const [draggingHandle, setDraggingHandle] = createSignal<"start" | "end" | null>(null);
  // Cache for waveform data loaded from audio files
  const [waveformCache, setWaveformCache] = createSignal<Map<string, number[]>>(new Map());
  // Track scroll position for timeline markers
  const [scrollLeft, setScrollLeft] = createSignal(0);
  const [viewportWidth, setViewportWidth] = createSignal(0);
  // Version counter to invalidate stale position updates from async polling
  const [positionVersion, setPositionVersion] = createSignal(0);

  let waveformRef: HTMLDivElement | undefined;
  let positionInterval: number | undefined;
  let levelInterval: number | undefined;

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

  onMount(async () => {
    // Check if audio engine is available
    try {
      const available = await invoke<boolean>("is_audio_available");
      if (!available) {
        setAudioError("Audio not available - microphone access may be denied");
      }
    } catch (e) {
      setAudioError(`Audio check failed: ${e}`);
    }

    positionInterval = window.setInterval(async () => {
      // Only poll position when playing or recording
      if (!isPlaying() && !isRecording()) return;

      // Capture version before async call to detect stale responses
      const version = positionVersion();
      try {
        const pos = await invoke<number>("get_position");
        // Only update if version hasn't changed (no stop/seek operation occurred)
        if (positionVersion() !== version) return;
        setPlayheadMs(pos);
        // Stop playback when reaching end of content
        const contentDuration = getContentDuration();
        if (contentDuration > 0 && pos >= contentDuration && isPlaying() && !isRecording()) {
          await invoke("pause");
          setIsPlaying(false);
        }
      } catch (_e) {}
    }, POSITION_POLL_MS);

    // Poll input level for live waveform during recording
    levelInterval = window.setInterval(async () => {
      try {
        const level = await invoke<number>("get_input_level");
        setInputLevel(level);
        // Add to recording waveform when recording
        if (isRecording()) {
          setRecordingWaveform((prev) => [...prev, level]);
        }
      } catch (_e) {}
    }, LEVEL_POLL_MS);
  });

  onCleanup(() => {
    if (positionInterval) clearInterval(positionInterval);
    if (levelInterval) clearInterval(levelInterval);
  });

  // Auto-scroll to follow playhead during recording/playback
  createEffect(() => {
    if (!waveformRef) return;
    const playhead = playheadMs();
    const playing = isPlaying();
    const recording = isRecording();

    if (playing || recording) {
      const playheadPx = msToPixels(playhead);
      const viewportWidth = waveformRef.clientWidth;
      // Keep playhead at 75% of viewport (near right edge, leaving room for incoming audio)
      const targetScroll = playheadPx - viewportWidth * 0.75;
      waveformRef.scrollLeft = Math.max(0, targetScroll);
    }
  });

  const getContentDuration = () => {
    const mix = store.currentMix();
    if (!mix) return 0;
    let max = 0;
    for (const track of mix.tracks) {
      if (track.clip) {
        // Account for clip position + duration
        const clipEnd = (track.clip.position_ms || 0) + track.clip.original_duration_ms;
        max = Math.max(max, clipEnd);
      }
    }
    // Include recording in progress
    if (isRecording()) {
      const recordingEnd = recordingStartMs() + recordingWaveform().length * LEVEL_POLL_MS;
      max = Math.max(max, recordingEnd);
    }
    return max;
  };

  // Timeline scale is the duration represented by the full timeline
  // Always use at least MIN_TIMELINE_MS to prevent jitter during early recording
  const getTimelineScale = () => {
    const content = getContentDuration();
    const base = Math.max(content, MIN_TIMELINE_MS);
    return base / zoomLevel();
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * ZOOM_FACTOR, ZOOM_MAX));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / ZOOM_FACTOR, ZOOM_MIN));

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
            setZoomLevel((z) => Math.min(z * PINCH_ZOOM_FACTOR, ZOOM_MAX));
          } else {
            setZoomLevel((z) => Math.max(z / PINCH_ZOOM_FACTOR, ZOOM_MIN));
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

  const handleSeek = async (e: MouseEvent) => {
    if (!waveformRef) return;
    const rect = waveformRef.getBoundingClientRect();
    const scrollOffset = waveformRef.scrollLeft;
    const x = e.clientX - rect.left + scrollOffset;
    const totalWidth = getTimelineWidthPx();
    const normalized = x / totalWidth;
    const positionMs = Math.floor(normalized * getTimelineScale());
    await invoke("seek", { positionMs }).catch(() => {});
    setPlayheadMs(positionMs);
  };

  const handlePlayStop = async () => {
    if (isPlaying()) {
      if (isRecording()) {
        await handleStopRecording();
      } else {
        await invoke("pause").catch(() => {});
        setIsPlaying(false);
      }
    } else {
      await invoke("play").catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSkip = async (deltaMs: number) => {
    const maxPos = getContentDuration();
    const newPos = Math.max(0, Math.min(maxPos, playheadMs() + deltaMs));
    await invoke("seek", { positionMs: newPos }).catch(() => {});
    setPlayheadMs(newPos);
  };

  const handleRecord = async () => {
    const mix = store.currentMix();
    const path = store.mixPath();
    if (!mix || !path) return;

    try {
      if (isRecording()) {
        await handleStopRecording();
      } else {
        // Add track if none exist
        if (mix.tracks.length === 0) {
          store.addTrack();
          await store.saveMix(); // Save so audio folder exists
        }

        const trackIndex = store.selectedTrack();
        const track = mix.tracks[trackIndex];

        // Clear recording waveform
        setRecordingWaveform([]);

        // If track has existing clip, save its path for splice operation
        if (track?.clip) {
          const clipPath = `${path}/${track.clip.audio_file}`;
          setExistingClipPath(clipPath);
          // Mute the track so we don't hear old audio while recording
          store.updateTrackMute(trackIndex, true);
          await store.reloadTracks();
        } else {
          setExistingClipPath(null);
        }

        const filename = await invoke<string>("start_recording", {
          trackIndex,
          projectPath: path,
        });

        setRecordingFilename(filename);
        setIsRecording(true);
        setIsPlaying(true);
        await invoke("play");

        // Capture position AFTER playback starts to avoid latency offset
        const currentPlayhead = await invoke<number>("get_position");
        setRecordingStartMs(currentPlayhead);
      }
    } catch (e) {
      setAudioError(`Recording failed: ${e}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      // Increment version FIRST to invalidate any in-flight position polling responses
      setPositionVersion((v) => v + 1);

      await invoke("stop_recording");
      // Pause playback to stop position polling from overwriting our playhead
      await invoke("pause").catch(() => {});
      setIsPlaying(false);
      setIsRecording(false);

      const filename = recordingFilename();
      const trackIndex = store.selectedTrack();
      const path = store.mixPath();
      const startMs = recordingStartMs();
      const existingPath = existingClipPath();
      // Capture waveform data before clearing
      const waveformData = recordingWaveform();
      // Calculate duration from samples (more accurate than playhead which may drift)
      const recordingDuration = waveformData.length * 50; // 50ms per sample
      // Set playhead to end of recording
      const endPosition = startMs + recordingDuration;
      await invoke("seek", { positionMs: endPosition }).catch(() => {});
      setPlayheadMs(endPosition);

      if (filename && recordingDuration > 0 && path) {
        const newRecordingPath = `${path}/audio/${filename}`;

        if (existingPath) {
          // REPLACE mode: Splice new recording into existing audio
          const newDuration = await invoke<number>("splice_recording", {
            originalPath: existingPath,
            newRecordingPath: newRecordingPath,
            startMs: startMs,
            outputPath: existingPath, // Overwrite original
          });

          // Pause playback before reloading to avoid audio glitches
          await invoke("pause").catch(() => {});

          // Unmute the track now that we're done recording
          store.updateTrackMute(trackIndex, false);

          // Update clip with new duration
          await store.updateClipDuration(trackIndex, newDuration);
          await store.saveMix();

          // Invalidate waveform cache - audio file was modified
          setWaveformCache((prev) => {
            const next = new Map(prev);
            next.delete(existingPath);
            return next;
          });

          // Reload the audio into the engine so it plays the new spliced audio
          await store.reloadTracks();
        } else {
          // NEW recording: Add as new clip at the position where recording started
          await store.addClipToTrack(
            trackIndex,
            `audio/${filename}`,
            recordingDuration,
            startMs, // Position in timeline where recording started
          );
          await store.saveMix();
        }
      }

      setRecordingFilename(null);
      setExistingClipPath(null);
      setRecordingWaveform([]);
    } catch (e) {
      alert(`Stop recording failed: ${e}`);
    }
  };

  // Load waveform from audio file via backend
  const loadWaveform = async (audioPath: string, forceReload = false) => {
    const cache = waveformCache();
    if (!forceReload && cache.has(audioPath)) return;

    try {
      const waveform = await invoke<number[]>("get_waveform", { audioPath });
      setWaveformCache((prev) => {
        const next = new Map(prev);
        next.set(audioPath, waveform);
        return next;
      });
    } catch (e) {
      console.error(`Failed to load waveform for ${audioPath}:`, e);
    }
  };

  // Invalidate waveform cache for a specific audio file (call after modifying audio)
  const invalidateWaveform = (audioPath: string) => {
    setWaveformCache((prev) => {
      const next = new Map(prev);
      next.delete(audioPath);
      return next;
    });
    // Reload the waveform from the modified file
    loadWaveform(audioPath, true);
  };

  // Load waveforms when mix/tracks change
  createEffect(() => {
    const mix = store.currentMix();
    const path = store.mixPath();
    if (!mix || !path) return;

    for (const track of mix.tracks) {
      if (track.clip) {
        const audioPath = `${path}/${track.clip.audio_file}`;
        loadWaveform(audioPath);
      }
    }
  });

  // Get samples for a clip from cache (returns empty if not loaded yet)
  const getClipSamples = (clip: Clip): number[] => {
    const path = store.mixPath();
    if (!path) return [];
    const audioPath = `${path}/${clip.audio_file}`;
    return waveformCache().get(audioPath) || [];
  };

  // Single source of truth for waveform bar count calculation
  // 20 bars per second (matches LEVEL_POLL_MS = 50ms), minimum 20 bars
  const getBarCount = (durationMs: number) => Math.max(20, Math.floor(durationMs / 50));

  // Convert duration to pixel width (bar count * pixels per bar)
  const getWidthPx = (durationMs: number) => getBarCount(durationMs) * BAR_UNIT_PX;

  // Get total timeline width in pixels
  // Always uses pixel-based calculation to match waveform bar widths
  const getTimelineWidthPx = () => {
    const vw = viewportWidth();
    // Calculate width from timeline scale using same formula as waveforms
    const contentWidth = getWidthPx(getTimelineScale());
    // Use at least viewport width so short content fills the space
    return vw > 0 ? Math.max(contentWidth, vw) : contentWidth;
  };

  // Convert ms position to pixel position
  const msToPixels = (ms: number) => (ms / getTimelineScale()) * getTimelineWidthPx();

  // Compute visible time range for timeline markers (reactive)
  const getVisibleTimeMarkers = () => {
    const totalWidth = getTimelineWidthPx();
    const visibleStartPx = scrollLeft();
    const visibleWidthPx = viewportWidth() || totalWidth;
    const scale = getTimelineScale();

    // Convert pixel positions to ms
    const startMs = totalWidth > 0 ? (visibleStartPx / totalWidth) * scale : 0;
    const visibleDurationMs = totalWidth > 0 ? (visibleWidthPx / totalWidth) * scale : scale;

    // Return 5 evenly spaced timestamps
    return [0, 0.25, 0.5, 0.75, 1].map((pct) => startMs + pct * visibleDurationMs);
  };

  // Auto-stop playback when reaching end of content
  const _checkPlaybackEnd = () => {
    const contentDuration = getContentDuration();
    if (contentDuration > 0 && playheadMs() >= contentDuration && isPlaying() && !isRecording()) {
      invoke("pause").catch(() => {});
      setIsPlaying(false);
    }
  };

  const currentTrack = () => {
    const mix = store.currentMix();
    if (!mix || mix.tracks.length === 0) return null;
    const idx = store.selectedTrack();
    if (idx < 0 || idx >= mix.tracks.length) return null;
    return mix.tracks[idx];
  };

  // Trim mode drag handlers
  const getTrimPosition = (e: MouseEvent | TouchEvent): number => {
    if (!waveformRef) return 0;
    const rect = waveformRef.getBoundingClientRect();
    const clientX =
      "touches" in e ? (e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX) : e.clientX;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const duration = currentTrack()?.clip?.original_duration_ms || 0;
    return Math.floor(pct * duration);
  };

  const handleTrimDragStart = (handle: "start" | "end") => (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);
  };

  const handleTrimDragMove = (e: MouseEvent | TouchEvent) => {
    if (!draggingHandle()) return;
    e.preventDefault();
    const ms = getTrimPosition(e);
    const duration = currentTrack()?.clip?.original_duration_ms || 0;

    if (draggingHandle() === "start") {
      setTrimStart(Math.max(0, Math.min(ms, trimEnd() - 100)));
    } else {
      setTrimEnd(Math.min(duration, Math.max(ms, trimStart() + 100)));
    }
  };

  const handleTrimDragEnd = () => {
    setDraggingHandle(null);
  };

  const enterTrimMode = () => {
    const track = currentTrack();
    if (!track?.clip) return;
    const duration = track.clip.original_duration_ms;
    // Initialize selection to middle 50%
    setTrimStart(Math.floor(duration * 0.25));
    setTrimEnd(Math.floor(duration * 0.75));
    setShowSettings(false);
    setTrimMode(true);
  };

  // Delete selection (keep everything outside selection)
  const handleTrimDelete = async () => {
    const track = currentTrack();
    const path = store.mixPath();
    if (!track?.clip || !path) return;

    const audioPath = `${path}/${track.clip.audio_file}`;
    try {
      const newDuration = await invoke<number>("trim_audio", {
        audioPath,
        startMs: trimStart(),
        endMs: trimEnd(),
        outputPath: audioPath,
      });
      store.updateClipDuration(store.selectedTrack(), newDuration);
      // Invalidate waveform cache - audio file was modified
      invalidateWaveform(audioPath);
      await store.reloadTracks();
      setTrimMode(false);
      setTrimStart(0);
      setTrimEnd(0);
    } catch (e) {
      setAudioError(`Trim failed: ${e}`);
    }
  };

  // Trim to selection (keep only selection, delete rest)
  const handleTrimKeep = async () => {
    const track = currentTrack();
    const path = store.mixPath();
    if (!track?.clip || !path) return;

    const audioPath = `${path}/${track.clip.audio_file}`;
    const duration = track.clip.original_duration_ms;

    try {
      // Delete everything after selection first
      if (trimEnd() < duration) {
        await invoke<number>("trim_audio", {
          audioPath,
          startMs: trimEnd(),
          endMs: duration,
          outputPath: audioPath,
        });
      }
      // Then delete everything before selection
      if (trimStart() > 0) {
        const newDuration = await invoke<number>("trim_audio", {
          audioPath,
          startMs: 0,
          endMs: trimStart(),
          outputPath: audioPath,
        });
        store.updateClipDuration(store.selectedTrack(), newDuration);
      } else {
        store.updateClipDuration(store.selectedTrack(), trimEnd() - trimStart());
      }
      // Invalidate waveform cache - audio file was modified
      invalidateWaveform(audioPath);
      await store.reloadTracks();
      setTrimMode(false);
      setTrimStart(0);
      setTrimEnd(0);
    } catch (e) {
      setAudioError(`Trim failed: ${e}`);
    }
  };

  return (
    <div
      class={`flex flex-col bg-black text-white ${props.inline ? "h-full" : "fixed inset-0"}`}
      style={{
        "padding-top": props.inline ? "0" : "env(safe-area-inset-top, 0px)",
        "padding-bottom": props.inline ? "0" : "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <button
          onClick={() => setShowSettings(true)}
          class="w-10 h-10 flex items-center justify-center text-neutral-400"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        </button>
        <div class="text-center">
          <div class="font-semibold">
            {trimMode() ? "Trim Mode" : store.currentMix()?.name || "New Mix"}
          </div>
          <div class="text-xs text-neutral-500">
            {trimMode()
              ? `Selection: ${formatTimeShort(trimEnd() - trimStart())}`
              : `${store.currentMix()?.tracks.length || 0} tracks`}
          </div>
        </div>
        <div class="flex items-center gap-1">
          {/* Trim icon */}
          <button
            onClick={
              trimMode()
                ? () => {
                    setTrimMode(false);
                    setTrimStart(0);
                    setTrimEnd(0);
                  }
                : enterTrimMode
            }
            class={`w-10 h-10 flex items-center justify-center ${
              trimMode()
                ? "text-selection"
                : currentTrack()?.clip
                  ? "text-neutral-400"
                  : "text-neutral-700"
            }`}
            disabled={!trimMode() && !currentTrack()?.clip}
            title={trimMode() ? "Exit trim mode" : "Trim audio"}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
              />
            </svg>
          </button>
          {/* View mode toggle - hide in trim mode */}
          <Show when={!trimMode()}>
            <button
              onClick={() => {
                const modes: Array<"single" | "overlay" | "stacked"> = [
                  "single",
                  "overlay",
                  "stacked",
                ];
                const current = modes.indexOf(viewMode());
                setViewMode(modes[(current + 1) % 3]);
              }}
              class="w-10 h-10 flex items-center justify-center text-neutral-400"
              title={`View: ${viewMode()}`}
            >
              {viewMode() === "single" && (
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="8" width="16" height="8" rx="1" stroke-width="2" />
                </svg>
              )}
              {viewMode() === "overlay" && (
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="6" width="16" height="6" rx="1" stroke-width="2" />
                  <rect x="4" y="12" width="16" height="6" rx="1" stroke-width="2" opacity="0.5" />
                </svg>
              )}
              {viewMode() === "stacked" && (
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="4" rx="1" stroke-width="1.5" />
                  <rect x="4" y="10" width="16" height="4" rx="1" stroke-width="1.5" />
                  <rect x="4" y="16" width="16" height="4" rx="1" stroke-width="1.5" />
                </svg>
              )}
            </button>
          </Show>
        </div>
      </div>

      {/* Audio Error Banner */}
      <Show when={audioError()}>
        <div class="bg-destructive/20 text-destructive px-4 py-2 text-sm text-center">
          {audioError()}
        </div>
      </Show>

      {/* Waveform Area - scrollable container */}
      <div
        ref={(el) => {
          waveformRef = el;
          // Initialize viewport width
          if (el) setViewportWidth(el.clientWidth);
        }}
        class="flex-1 relative bg-neutral-900 cursor-pointer min-h-[200px] overflow-x-auto overflow-y-hidden"
        onClick={trimMode() ? undefined : handleSeek}
        onWheel={trimMode() ? undefined : handleWheel}
        onScroll={(e) => {
          const target = e.currentTarget;
          setScrollLeft(target.scrollLeft);
          setViewportWidth(target.clientWidth);
        }}
        onTouchStart={trimMode() ? undefined : handleTouchStart}
        onTouchMove={(e) => {
          if (trimMode()) handleTrimDragMove(e);
          else handleTouchMove(e);
        }}
        onTouchEnd={() => {
          if (trimMode()) handleTrimDragEnd();
          else handleTouchEnd();
        }}
        onMouseMove={trimMode() ? handleTrimDragMove : undefined}
        onMouseUp={trimMode() ? handleTrimDragEnd : undefined}
        onMouseLeave={trimMode() ? handleTrimDragEnd : undefined}
      >
        {/* TRIM MODE - Yellow/gold selection like Voice Memos */}
        <Show when={trimMode()}>
          {(() => {
            const track = currentTrack();
            if (!track?.clip) return null;
            const clip = track.clip;
            const duration = clip.original_duration_ms;
            const samples = getClipSamples(clip);
            const startPct = (trimStart() / duration) * 100;
            const endPct = (trimEnd() / duration) * 100;

            return (
              <>
                {/* Full-width waveform - white bars */}
                <div class="absolute inset-0 flex items-center">
                  <Waveform
                    samples={samples}
                    barCount={getBarCount(duration)}
                    color="#ffffff"
                    opacity={0.7}
                  />
                </div>

                {/* Yellow/gold selection overlay */}
                <div
                  class="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `${startPct}%`,
                    width: `${endPct - startPct}%`,
                    "background-color": "rgba(180, 150, 80, 0.35)",
                    "border-top": "2px solid #c9a227",
                    "border-bottom": "2px solid #c9a227",
                  }}
                />

                {/* Start handle - Yellow line with chevron */}
                <div
                  class="absolute top-0 bottom-0 cursor-ew-resize z-20"
                  style={{ left: `calc(${startPct}% - 14px)`, width: "28px" }}
                  onMouseDown={handleTrimDragStart("start")}
                  onTouchStart={handleTrimDragStart("start")}
                >
                  {/* Vertical line */}
                  <div
                    class="absolute top-0 bottom-0 w-0.5"
                    style={{ left: "13px", "background-color": "#c9a227" }}
                  />
                  {/* Top dot */}
                  <div
                    class="absolute w-2.5 h-2.5 rounded-full"
                    style={{ top: "-5px", left: "10px", "background-color": "#c9a227" }}
                  />
                  {/* Bottom dot */}
                  <div
                    class="absolute w-2.5 h-2.5 rounded-full"
                    style={{ bottom: "-5px", left: "10px", "background-color": "#c9a227" }}
                  />
                  {/* Chevron */}
                  <div
                    class="absolute top-1/2 -translate-y-1/2 text-2xl font-bold"
                    style={{ left: "0px", color: "#c9a227" }}
                  >
                    ‹
                  </div>
                </div>

                {/* End handle - Yellow line with chevron */}
                <div
                  class="absolute top-0 bottom-0 cursor-ew-resize z-20"
                  style={{ left: `calc(${endPct}% - 14px)`, width: "28px" }}
                  onMouseDown={handleTrimDragStart("end")}
                  onTouchStart={handleTrimDragStart("end")}
                >
                  {/* Vertical line */}
                  <div
                    class="absolute top-0 bottom-0 w-0.5"
                    style={{ left: "13px", "background-color": "#c9a227" }}
                  />
                  {/* Top dot */}
                  <div
                    class="absolute w-2.5 h-2.5 rounded-full"
                    style={{ top: "-5px", left: "10px", "background-color": "#c9a227" }}
                  />
                  {/* Bottom dot */}
                  <div
                    class="absolute w-2.5 h-2.5 rounded-full"
                    style={{ bottom: "-5px", left: "10px", "background-color": "#c9a227" }}
                  />
                  {/* Chevron */}
                  <div
                    class="absolute top-1/2 -translate-y-1/2 text-2xl font-bold"
                    style={{ right: "0px", color: "#c9a227" }}
                  >
                    ›
                  </div>
                </div>
              </>
            );
          })()}
        </Show>

        {/* NORMAL MODE - inner container with pixel width for scrolling */}
        <Show when={!trimMode()}>
          <div
            class="relative h-full"
            style={{ width: `${getTimelineWidthPx()}px`, "min-width": "100%" }}
          >
            <Show
              when={store.currentMix()?.tracks.some((t) => t.clip) || isRecording()}
              fallback={
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-neutral-600">Tap record to start</span>
                  <span class="text-neutral-700 text-xs ml-2">
                    (tracks: {store.currentMix()?.tracks.length || 0})
                  </span>
                </div>
              }
            >
              {/* Single mode - only selected track */}
              <Show when={viewMode() === "single" && !isRecording()}>
                {(() => {
                  const track = store.currentMix()?.tracks[store.selectedTrack()];
                  if (!track?.clip) return null;
                  const clip = track.clip;
                  const durationMs = clip.original_duration_ms;
                  const positionPx = msToPixels(clip.position_ms || 0);
                  return (
                    <div
                      class="absolute top-0 bottom-0 flex items-center"
                      style={{ left: `${positionPx}px`, opacity: track.muted ? 0.3 : 1 }}
                    >
                      <Waveform
                        samples={getClipSamples(clip)}
                        color={track.color}
                        barCount={getBarCount(durationMs)}
                      />
                    </div>
                  );
                })()}
              </Show>

              {/* Overlay mode - all tracks overlaid, selected dominant */}
              <Show when={viewMode() === "overlay"}>
                <For each={store.currentMix()?.tracks}>
                  {(track, i) => {
                    if (!track.clip) return null;
                    const clip = track.clip;
                    const isSelected = () => i() === store.selectedTrack();
                    const isSelectedAndRecording = () => isSelected() && isRecording();
                    const durationMs = clip.original_duration_ms;
                    const positionPx = msToPixels(clip.position_ms || 0);
                    // Dim existing clip when recording over it
                    const opacity = () => {
                      if (isSelectedAndRecording()) return 0.3;
                      if (track.muted) return 0.15;
                      return isSelected() ? 0.9 : 0.4;
                    };
                    return (
                      <div
                        class="absolute top-0 bottom-0 flex items-center"
                        style={{
                          left: `${positionPx}px`,
                          opacity: opacity(),
                          "z-index": isSelected() ? 5 : 1,
                        }}
                      >
                        <Waveform
                          samples={getClipSamples(clip)}
                          color={track.color}
                          barCount={getBarCount(durationMs)}
                        />
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
                      // Must be a function for reactivity in SolidJS
                      const isSelected = () => i() === store.selectedTrack();
                      const isSelectedAndRecording = () => isSelected() && isRecording();
                      const clip = track.clip;
                      return (
                        <div
                          class="flex-1 relative border-b border-neutral-800 last:border-b-0 overflow-hidden"
                          style={{
                            "background-color": isSelected()
                              ? "rgba(255,255,255,0.03)"
                              : "transparent",
                          }}
                        >
                          {clip &&
                            (() => {
                              const durationMs = clip.original_duration_ms;
                              const positionPx = msToPixels(clip.position_ms || 0);
                              // Dim existing clip when recording over it
                              const opacity = isSelectedAndRecording()
                                ? 0.3
                                : track.muted
                                  ? 0.2
                                  : 0.8;
                              return (
                                <div
                                  class="absolute top-0 bottom-0 flex items-center"
                                  style={{ left: `${positionPx}px`, opacity }}
                                >
                                  <Waveform
                                    samples={getClipSamples(clip)}
                                    color={track.color}
                                    barCount={getBarCount(durationMs)}
                                  />
                                </div>
                              );
                            })()}
                          {/* Live recording waveform for this track */}
                          <Show when={isSelectedAndRecording()}>
                            {(() => {
                              const startPx = msToPixels(recordingStartMs());
                              const color = track.color || "#ff453a";
                              const samples = recordingWaveform();
                              const elapsedMs = playheadMs() - recordingStartMs();
                              const maxBars = Math.max(0, Math.floor(elapsedMs / 50));
                              const clippedSamples = samples.slice(0, maxBars);
                              return (
                                <div
                                  class="absolute top-0 bottom-0 pointer-events-none flex items-center"
                                  style={{ left: `${startPx}px`, opacity: 0.9, "z-index": 5 }}
                                >
                                  <Waveform samples={clippedSamples} color={color} live />
                                </div>
                              );
                            })()}
                          </Show>
                          {/* Track label */}
                          <div
                            class="absolute top-1 left-1 text-[9px] px-1 rounded text-white z-10"
                            style={{ "background-color": track.color, opacity: 0.8 }}
                          >
                            {track.name}
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Live recording waveform (for single and overlay modes) */}
              <Show when={isRecording() && viewMode() !== "stacked"}>
                {(() => {
                  const track = store.currentMix()?.tracks[store.selectedTrack()];
                  const startPx = msToPixels(recordingStartMs());
                  const color = track?.color || "#ff453a";
                  const samples = recordingWaveform();
                  // Clip samples to match playhead position (avoid running ahead due to timing)
                  const elapsedMs = playheadMs() - recordingStartMs();
                  const maxBars = Math.max(0, Math.floor(elapsedMs / 50));
                  const clippedSamples = samples.slice(0, maxBars);

                  return (
                    <div
                      class="absolute top-0 bottom-0 pointer-events-none flex items-center"
                      style={{
                        left: `${startPx}px`,
                        opacity: 0.9,
                        "z-index": 5,
                      }}
                    >
                      <Waveform samples={clippedSamples} color={color} live />
                    </div>
                  );
                })()}
              </Show>
            </Show>

            {/* Playhead */}
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10"
              style={{ left: `${msToPixels(playheadMs())}px` }}
            >
              <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        </Show>
      </div>

      {/* Timeline - shows visible time range based on scroll */}
      <div class="h-6 flex items-center justify-between px-4 text-xs text-neutral-500 bg-neutral-900 border-t border-neutral-800">
        {(() => {
          const markers = getVisibleTimeMarkers();
          return (
            <>
              <span>{formatTimeShort(markers[0])}</span>
              <span>{formatTimeShort(markers[1])}</span>
              <span>{formatTimeShort(markers[2])}</span>
              <span>{formatTimeShort(markers[3])}</span>
              <span>{formatTimeShort(markers[4])}</span>
            </>
          );
        })()}
      </div>

      {/* Time Display */}
      <div class="py-6 text-center bg-black">
        <span
          class={`font-mono text-5xl font-light ${isRecording() ? "text-destructive" : "text-white"}`}
        >
          {formatTime(playheadMs())}
        </span>
      </div>

      {/* Transport */}
      <div class="flex items-center justify-center gap-8 py-4 bg-black">
        <button
          onClick={() => handleSkip(-SKIP_DELTA_MS)}
          class="w-12 h-12 flex items-center justify-center text-white"
        >
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            <text x="9" y="14" font-size="6" font-weight="bold">
              15
            </text>
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
          onClick={() => handleSkip(SKIP_DELTA_MS)}
          class="w-12 h-12 flex items-center justify-center text-white"
        >
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            <text x="9" y="14" font-size="6" font-weight="bold">
              15
            </text>
          </svg>
        </button>
      </div>

      {/* Bottom Controls - hide in trim mode */}
      <Show when={!trimMode()}>
        <div class="px-4 py-3">
          {/* Track Selector Row */}
          <div class="flex items-center justify-center gap-3 mb-3">
            <For each={store.currentMix()?.tracks || []}>
              {(track, i) => (
                <button
                  onClick={() => store.setSelectedTrack(i())}
                  class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    "background-color": track.color,
                    border:
                      store.selectedTrack() === i() ? "2px solid white" : "2px solid transparent",
                  }}
                >
                  {i() + 1}
                </button>
              )}
            </For>
            <button
              onClick={() => store.addTrack()}
              class="w-8 h-8 rounded-full border border-neutral-600 text-neutral-500 flex items-center justify-center text-xl"
            >
              +
            </button>
          </div>
          {/* Record/Done Row */}
          <div class="flex items-center justify-between">
            <div class="w-20" />
            <button
              onClick={handleRecord}
              class={`px-8 py-3 rounded-full font-semibold text-lg ${
                isRecording() ? "bg-destructive text-white" : "bg-destructive text-white"
              }`}
            >
              {isRecording() ? "STOP" : currentTrack()?.clip ? "REPLACE" : "RECORD"}
            </button>
            {/* Mobile: breadcrumb back button, Desktop: empty spacer */}
            <Show when={!props.inline} fallback={<div class="w-20" />}>
              <button
                onClick={async () => {
                  if (isPlaying()) {
                    await invoke("pause");
                    setIsPlaying(false);
                  }
                  if (isRecording()) {
                    await handleStopRecording();
                  }
                  props.onDone();
                }}
                class="w-20 text-neutral-400 font-medium text-right flex items-center justify-end gap-1"
              >
                <span class="truncate text-sm">{props.breadcrumb || "Back"}</span>
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Trim Mode Bottom Controls */}
      <Show when={trimMode()}>
        <div class="px-4 py-4 bg-neutral-900/50">
          <div class="flex items-center justify-between">
            {/* Left: Trim and Delete buttons */}
            <div class="flex gap-2">
              <button
                onClick={handleTrimKeep}
                class="px-4 py-2 rounded-lg bg-neutral-700 text-neutral-300 text-sm font-medium"
              >
                Trim
              </button>
              <button
                onClick={handleTrimDelete}
                class="px-4 py-2 rounded-lg bg-neutral-700 text-neutral-300 text-sm font-medium"
              >
                Delete
              </button>
            </div>
            {/* Right: Cancel and Apply buttons */}
            <div class="flex gap-2">
              <button
                onClick={() => {
                  setTrimMode(false);
                  setTrimStart(0);
                  setTrimEnd(0);
                }}
                class="px-5 py-2 rounded-full bg-neutral-700 text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTrimDelete}
                class="px-5 py-2 rounded-full bg-neutral-700 text-neutral-500 text-sm font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Settings Modal */}
      <Show when={showSettings()}>
        <TrackSettingsModal
          mix={store.currentMix()}
          onClose={() => setShowSettings(false)}
          onUpdateVolume={store.updateTrackVolume}
          onUpdateSolo={store.updateTrackSolo}
          onUpdateMute={store.updateTrackMute}
          onRemoveTrack={store.removeTrack}
          onAddTrack={store.addTrack}
        />
      </Show>
    </div>
  );
};
