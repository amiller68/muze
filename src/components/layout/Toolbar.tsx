import { Component, Show } from "solid-js";
import { useProjectStore } from "../../stores/projectStore";

export const Toolbar: Component = () => {
  const store = useProjectStore();

  const handleSave = async () => {
    try {
      await store.saveProject();
    } catch (e) {
      console.error("Failed to save:", e);
    }
  };

  return (
    <div
      class="flex items-center justify-between px-4 bg-bg-secondary border-b border-border"
      style={{ height: "var(--toolbar-height)" }}
    >
      {/* Project info */}
      <div class="flex items-center gap-3">
        <Show
          when={store.currentProject()}
          fallback={
            <span class="text-sm text-gray-500">No project open</span>
          }
        >
          <span class="text-sm font-medium text-gray-300">
            {store.currentProject()?.name}
          </span>
          <span class="text-xs text-gray-500">
            {store.currentProject()?.sample_rate / 1000}kHz
          </span>
          <Show when={store.isDirty()}>
            <span class="text-xs text-yellow-500">Unsaved</span>
          </Show>
        </Show>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-2">
        <Show when={store.currentProject() && store.isDirty()}>
          <button
            onClick={handleSave}
            class="px-3 py-1 text-xs bg-accent-primary hover:bg-indigo-600 rounded transition-colors"
          >
            Save
          </button>
        </Show>
      </div>
    </div>
  );
};
