import { vi } from "vitest";

// Mock Tauri's invoke function
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    switch (cmd) {
      case "is_audio_available":
        return Promise.resolve(true);
      case "is_playing":
        return Promise.resolve(false);
      case "is_recording":
        return Promise.resolve(false);
      case "get_position":
        return Promise.resolve(0);
      case "get_input_level":
        return Promise.resolve(0);
      default:
        return Promise.resolve();
    }
  }),
}));

// Mock Tauri's event listener
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock Tauri's path module
vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/mock/app/data"),
  join: vi.fn().mockImplementation((...parts: string[]) => Promise.resolve(parts.join("/"))),
}));

// Mock Tauri's fs module
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn().mockResolvedValue("{}"),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  readDir: vi.fn().mockResolvedValue([]),
}));
