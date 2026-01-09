import { Component, createSignal, onMount, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useMixStore } from "../../stores/projectStore";

interface FolderEntry {
  name: string;
  path: string;
  is_project: boolean;
}

export const Sidebar: Component = () => {
  const store = useMixStore();
  const [mixesPath, setMixesPath] = createSignal<string>("");
  const [mixes, setMixes] = createSignal<FolderEntry[]>([]);
  const [isCreating, setIsCreating] = createSignal(false);
  const [newMixName, setNewMixName] = createSignal("");

  onMount(async () => {
    try {
      const path = await invoke<string>("get_default_projects_path");
      setMixesPath(path);
      await refreshMixes(path);
    } catch (e) {
      console.error("Failed to get mixes path:", e);
    }
  });

  const refreshMixes = async (path: string) => {
    try {
      const entries = await invoke<FolderEntry[]>("list_projects", {
        rootPath: path,
      });
      setMixes(entries.filter((e) => e.is_project));
    } catch (e) {
      console.error("Failed to list mixes:", e);
    }
  };

  const handleCreateMix = async () => {
    const name = newMixName().trim();
    if (!name) return;

    try {
      await store.createMix(name, mixesPath());
      setNewMixName("");
      setIsCreating(false);
      await refreshMixes(mixesPath());
    } catch (e) {
      console.error("Failed to create mix:", e);
    }
  };

  const handleLoadMix = async (path: string) => {
    try {
      await store.loadMix(path);
    } catch (e) {
      console.error("Failed to load mix:", e);
    }
  };

  return (
    <div class="w-52 flex flex-col bg-bg-secondary border-r border-border shrink-0">
      {/* Header */}
      <div class="h-10 flex items-center px-4 border-b border-border">
        <h1 class="text-base font-semibold text-gray-200">Muze</h1>
      </div>

      {/* Current mix */}
      <Show when={store.currentMix()}>
        <div class="px-3 py-2 bg-accent-primary/10 border-b border-border">
          <div class="text-[10px] text-gray-500 uppercase tracking-wide">Open</div>
          <div class="text-sm text-gray-200 truncate">
            {store.currentMix()?.name}
          </div>
        </div>
      </Show>

      {/* Mix list */}
      <div class="flex-1 overflow-y-auto py-2">
        <div class="px-3 mb-2 text-[10px] text-gray-500 uppercase tracking-wide">
          Mixes
        </div>
        <Show
          when={mixes().length > 0}
          fallback={
            <div class="px-3 text-xs text-gray-600">No mixes yet</div>
          }
        >
          <For each={mixes()}>
            {(mix) => (
              <button
                onClick={() => handleLoadMix(mix.path)}
                class={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  store.mixPath() === mix.path
                    ? "bg-accent-primary/20 text-white"
                    : "text-gray-400 hover:bg-bg-tertiary hover:text-gray-200"
                }`}
              >
                {mix.name}
              </button>
            )}
          </For>
        </Show>
      </div>

      {/* New mix */}
      <div class="p-3 border-t border-border">
        <Show
          when={isCreating()}
          fallback={
            <button
              onClick={() => setIsCreating(true)}
              class="w-full py-1.5 text-sm bg-accent-primary hover:bg-indigo-600 rounded transition-colors"
            >
              New Mix
            </button>
          }
        >
          <input
            type="text"
            value={newMixName()}
            onInput={(e) => setNewMixName(e.currentTarget.value)}
            onKeyPress={(e) => e.key === "Enter" && handleCreateMix()}
            placeholder="Mix name..."
            class="w-full px-2 py-1.5 mb-2 bg-bg-tertiary border border-border rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            autofocus
          />
          <div class="flex gap-2">
            <button
              onClick={handleCreateMix}
              disabled={!newMixName().trim()}
              class="flex-1 py-1 text-sm bg-accent-primary disabled:bg-gray-700 rounded"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewMixName("");
              }}
              class="py-1 px-2 text-sm bg-bg-tertiary rounded"
            >
              Cancel
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
