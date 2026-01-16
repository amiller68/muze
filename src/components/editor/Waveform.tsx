import { type Component, For } from "solid-js";

// Fixed pixel dimensions - bars never change size
const BAR_WIDTH_PX = 3;
const BAR_GAP_PX = 2;
const BAR_UNIT_PX = BAR_WIDTH_PX + BAR_GAP_PX; // 5px per bar
const DEFAULT_HEIGHT_PX = 100;
const MIN_BAR_HEIGHT_PX = 1;

// Processing constants
const AMPLIFICATION = 4;

interface WaveformProps {
  /** Raw amplitude samples (0-1 range) */
  samples: number[];
  /** Bar fill color */
  color: string;
  /** Overall opacity (0-1), default 1 */
  opacity?: number;
  /** Number of bars to display (for resampled mode) */
  barCount?: number;
  /** Height in pixels, default 100 */
  height?: number;
  /** If true, render samples 1:1 without resampling (for live recording) */
  live?: boolean;
}

/**
 * Resamples raw amplitude data to fixed number of display bars.
 * Handles amplification consistently.
 */
function resampleToBars(samples: number[], targetCount: number): number[] {
  if (samples.length === 0) return [];

  const result: number[] = [];
  const step = samples.length / targetCount;

  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(Math.floor(i * step), samples.length - 1);
    // Amplify and clamp to 0-1
    result.push(Math.min(1, (samples[idx] || 0) * AMPLIFICATION));
  }

  return result;
}

export const Waveform: Component<WaveformProps> = (props) => {
  const height = () => props.height ?? DEFAULT_HEIGHT_PX;

  // In live mode, render samples 1:1. Otherwise resample to barCount.
  const bars = () => {
    if (props.live) {
      // Live mode: one bar per sample, just amplify
      return props.samples.map((s) => Math.min(1, s * AMPLIFICATION));
    }
    return resampleToBars(props.samples, props.barCount ?? props.samples.length);
  };

  const numBars = () => bars().length;
  const svgWidth = () => numBars() * BAR_UNIT_PX;

  return (
    <svg
      width={svgWidth()}
      height={height()}
      viewBox={`0 0 ${svgWidth()} ${height()}`}
      style={{ display: "block" }}
    >
      <For each={bars()}>
        {(amplitude, idx) => {
          const maxBarHeight = height() * 0.8; // 80% of height for bars
          const barHeight = Math.max(amplitude * maxBarHeight, MIN_BAR_HEIGHT_PX);
          const x = idx() * BAR_UNIT_PX;
          const centerY = height() / 2;
          return (
            <rect
              x={x}
              y={centerY - barHeight / 2}
              width={BAR_WIDTH_PX}
              height={barHeight}
              rx={1}
              fill={props.color}
              opacity={props.opacity ?? 1}
            />
          );
        }}
      </For>
    </svg>
  );
};

// Export for use in MixEditor calculations
export { BAR_UNIT_PX };
