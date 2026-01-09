import { Component } from "solid-js";
import { Sidebar } from "./Sidebar";
import { TransportBar } from "../transport/TransportBar";
import { WaveformView } from "../waveform/WaveformView";
import { TrackSelector } from "../tracks/TrackSelector";

export const AppShell: Component = () => {
  return (
    <div class="flex h-screen bg-bg-primary">
      {/* Sidebar - mix browser */}
      <Sidebar />

      {/* Main content */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Transport controls */}
        <TransportBar />

        {/* Main area: waveform + track selector */}
        <div class="flex-1 flex min-h-0">
          {/* Overlaid waveform view */}
          <WaveformView />

          {/* Track selector */}
          <TrackSelector />
        </div>
      </div>
    </div>
  );
};
