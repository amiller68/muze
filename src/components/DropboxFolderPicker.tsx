import { type Component, For, onMount, Show } from "solid-js";
import { useDropboxStore } from "../stores/dropboxStore";

interface DropboxFolderPickerProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export const DropboxFolderPicker: Component<DropboxFolderPickerProps> = (props) => {
  const dropbox = useDropboxStore();

  onMount(() => {
    // Start at root folder
    dropbox.listFolder("");
  });

  const handleFolderClick = (path: string) => {
    dropbox.navigateToFolder(path);
  };

  const handleSelect = () => {
    props.onSelect(dropbox.currentPath() || "/");
  };

  // Breadcrumb path segments
  const pathSegments = () => {
    const path = dropbox.currentPath();
    if (!path) return [{ name: "Dropbox", path: "" }];

    const parts = path.split("/").filter(Boolean);
    const segments = [{ name: "Dropbox", path: "" }];

    let currentPath = "";
    for (const part of parts) {
      currentPath += `/${part}`;
      segments.push({ name: part, path: currentPath });
    }

    return segments;
  };

  return (
    <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div class="bg-neutral-900 rounded-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 class="text-lg font-semibold">Select Dropbox Folder</h2>
          <button onClick={props.onCancel} class="text-neutral-400 hover:text-neutral-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        <div class="flex items-center gap-1 px-4 py-2 text-sm overflow-x-auto border-b border-neutral-800">
          <For each={pathSegments()}>
            {(segment, i) => (
              <>
                <Show when={i() > 0}>
                  <span class="text-neutral-600">/</span>
                </Show>
                <button
                  onClick={() => dropbox.navigateToFolder(segment.path)}
                  class="text-neutral-400 hover:text-white shrink-0"
                >
                  {segment.name}
                </button>
              </>
            )}
          </For>
        </div>

        {/* Folder list */}
        <div class="flex-1 overflow-y-auto min-h-[200px]">
          <Show when={dropbox.isLoadingFolder()}>
            <div class="flex items-center justify-center h-32">
              <div class="w-6 h-6 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!dropbox.isLoadingFolder() && dropbox.error()}>
            <div class="p-4 text-center text-red-400 text-sm">{dropbox.error()}</div>
          </Show>

          <Show when={!dropbox.isLoadingFolder() && !dropbox.error()}>
            {/* Navigate up button */}
            <Show when={dropbox.currentPath()}>
              <button
                onClick={() => dropbox.navigateUp()}
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 border-b border-neutral-800"
              >
                <svg
                  class="w-5 h-5 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 17l-5-5m0 0l5-5m-5 5h12"
                  />
                </svg>
                <span class="text-neutral-400">..</span>
              </button>
            </Show>

            {/* Folders only */}
            <For each={dropbox.currentFolder().filter((entry) => entry.is_folder)}>
              {(folder) => (
                <button
                  onClick={() => handleFolderClick(folder.path)}
                  class="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 border-b border-neutral-800"
                >
                  <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  <span class="text-neutral-200 truncate">{folder.name}</span>
                  <svg
                    class="w-4 h-4 text-neutral-600 ml-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </For>

            {/* Empty state */}
            <Show
              when={
                dropbox.currentFolder().filter((e) => e.is_folder).length === 0 &&
                !dropbox.currentPath()
              }
            >
              <div class="p-4 text-center text-neutral-500 text-sm">No folders found</div>
            </Show>
          </Show>
        </div>

        {/* Footer with actions */}
        <div class="p-4 border-t border-neutral-800 space-y-3">
          <div class="text-xs text-neutral-500 truncate">
            Selected: {dropbox.currentPath() || "/ (Dropbox root)"}
          </div>
          <div class="flex gap-2">
            <button
              onClick={props.onCancel}
              class="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              class="flex-1 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
