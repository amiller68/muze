import { Component, createSignal, Show, For, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { MixEditor } from "./components/editor/MixEditor";
import { useMixStore } from "./stores/projectStore";

interface FolderEntry {
  name: string;
  path: string;
  entry_type: "collection" | "project" | "mix" | "unknown";
  modified_at: string | null;
}

// Extended entry with children for preview
interface EntryWithChildren extends FolderEntry {
  children?: FolderEntry[];
}

// View modes: browser (collections), project (mixes inside a project), editor
type ViewMode = "browser" | "project" | "editor";

const App: Component = () => {
  const store = useMixStore();
  const [view, setView] = createSignal<ViewMode>("browser");
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [pathStack, setPathStack] = createSignal<string[]>([]);
  const [entries, setEntries] = createSignal<EntryWithChildren[]>([]);
  const [isCreating, setIsCreating] = createSignal<"mix" | "collection" | "project" | "select" | null>(null);
  const [newName, setNewName] = createSignal("");
  const [currentProject, setCurrentProject] = createSignal<FolderEntry | null>(null);
  const [menuEntry, setMenuEntry] = createSignal<FolderEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<FolderEntry | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showSearch, setShowSearch] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);

  onMount(async () => {
    try {
      const path = await invoke<string>("get_default_projects_path");
      setCurrentPath(path);
      setPathStack([path]);
      await refreshEntries(path);
    } catch (e) {
      console.error("Failed to get path:", e);
    }
  });

  const refreshEntries = async (path: string) => {
    try {
      const items = await invoke<FolderEntry[]>("list_entries", { path });

      // Load one level of children for collections
      const entriesWithChildren: EntryWithChildren[] = await Promise.all(
        items.map(async (entry) => {
          if (entry.entry_type === "collection") {
            try {
              const children = await invoke<FolderEntry[]>("list_entries", { path: entry.path });
              return { ...entry, children: children.slice(0, 4) };
            } catch {
              return entry;
            }
          }
          return entry;
        })
      );

      setEntries(entriesWithChildren);
    } catch (e) {
      console.error("Failed to list entries:", e);
    }
  };

  const navigateTo = async (path: string) => {
    setCurrentPath(path);
    setPathStack((prev) => [...prev, path]);
    setSearchQuery("");
    setShowSearch(false);
    await refreshEntries(path);
  };

  const navigateBack = async () => {
    const stack = pathStack();
    if (stack.length > 1) {
      const newStack = stack.slice(0, -1);
      const newPath = newStack[newStack.length - 1];
      setPathStack(newStack);
      setCurrentPath(newPath);
      setSearchQuery("");
      setShowSearch(false);
      await refreshEntries(newPath);
    }
  };

  const handleEntryClick = async (entry: FolderEntry) => {
    if (entry.entry_type === "mix") {
      // Open mix in editor - set view immediately, load in background
      setView("editor");
      store.loadMix(entry.path).catch(e => {
        console.error("Failed to load mix:", e);
        // Go back to previous view on error
        const project = currentProject();
        if (project) {
          setView("project");
        } else {
          setView("browser");
        }
      });
    } else if (entry.entry_type === "project") {
      // Open project view (shows mixes inside)
      setCurrentProject(entry);
      setCurrentPath(entry.path);
      setView("project"); // Set view first
      // Load entries in background
      invoke<FolderEntry[]>("list_entries", { path: entry.path })
        .then(items => setEntries(items))
        .catch(e => console.error("Failed to load project entries:", e));
    } else if (entry.entry_type === "collection") {
      // Navigate into collection
      await navigateTo(entry.path);
    }
  };

  const navigateBackFromProject = async () => {
    const stack = pathStack();
    const parentPath = stack.length > 0 ? stack[stack.length - 1] : currentPath();
    setCurrentProject(null);
    setCurrentPath(parentPath);
    await refreshEntries(parentPath);
    setView("browser");
  };

  const handleCreate = async () => {
    const name = newName().trim();
    const type = isCreating();
    if (!name || !type) return;

    try {
      if (type === "collection") {
        await invoke("create_collection", { name, parentPath: currentPath() });
        await refreshEntries(currentPath());
      } else if (type === "project") {
        // Create project folder with project.json
        await invoke("create_project_folder", { name, parentPath: currentPath() });
        await refreshEntries(currentPath());
      } else if (type === "mix") {
        // Mix creation - use project path if in project view, otherwise current path
        const project = currentProject();
        const parentPath = project ? project.path : currentPath();
        await store.createMix(name, parentPath);
        setView("editor");
      }
      setNewName("");
      setIsCreating(null);
    } catch (e) {
      console.error("Failed to create:", e);
    }
  };

  const handleDone = async () => {
    try {
      await store.saveMix();
    } catch (e) {
      console.error("Save failed:", e);
    }
    const project = currentProject();
    if (project) {
      await refreshEntries(project.path);
      setView("project");
    } else {
      await refreshEntries(currentPath());
      setView("browser");
    }
  };

  const handleDelete = async (entry: FolderEntry) => {
    setIsDeleting(true);
    try {
      await invoke("delete_entry", { entryPath: entry.path });
      setConfirmDelete(null);
      setMenuEntry(null);
      // Refresh the current view
      const project = currentProject();
      if (project) {
        const items = await invoke<FolderEntry[]>("list_entries", { path: project.path });
        setEntries(items);
      } else {
        await refreshEntries(currentPath());
      }
    } catch (e) {
      console.error("Delete failed:", e);
      alert(`Failed to delete: ${e}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const currentFolderName = () => {
    const path = currentPath();
    const parts = path.split("/");
    return parts[parts.length - 1] || "Muze";
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "collection": return "Collection";
      case "project": return "Project";
      case "mix": return "Mix";
      default: return "";
    }
  };

  // Filter entries based on search query
  const filteredEntries = () => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return entries();
    return entries().filter(e => e.name.toLowerCase().includes(query));
  };

  // Get mixes from current entries (for project view)
  const mixEntries = () => entries().filter(e => e.entry_type === "mix");

  return (
    <div class="h-screen bg-black text-white">
      <Show when={view() === "editor"}>
        <Show
          when={store.currentMix()}
          fallback={
            <div class="h-full flex items-center justify-center bg-black">
              <div class="text-neutral-400">Loading...</div>
            </div>
          }
        >
          <MixEditor onDone={handleDone} />
        </Show>
      </Show>

      <Show when={view() === "browser"}>
        <div
          class="h-full flex flex-col bg-black relative"
          style={{
            "padding-top": "env(safe-area-inset-top, 0px)",
            "padding-bottom": "env(safe-area-inset-bottom, 0px)"
          }}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-4 gap-3">
            <Show when={!showSearch()}>
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <Show when={pathStack().length > 1}>
                  <button
                    onClick={navigateBack}
                    class="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0"
                  >
                    <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </Show>
                <h1 class="text-2xl font-bold truncate">{currentFolderName()}</h1>
              </div>
            </Show>
            <Show when={showSearch()}>
              <div class="flex-1 flex items-center gap-2">
                <div class="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    placeholder="Search..."
                    class="w-full pl-10 pr-4 py-2.5 bg-neutral-800 rounded-full text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    autofocus
                  />
                  <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </Show>
            <button
              onClick={() => {
                setShowSearch(!showSearch());
                if (showSearch()) setSearchQuery("");
              }}
              class="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0"
            >
              <Show when={!showSearch()}>
                <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Show>
              <Show when={showSearch()}>
                <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Show>
            </button>
          </div>

          {/* Grid */}
          <div class="flex-1 overflow-y-auto px-4 pb-24">
            <Show
              when={entries().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full text-neutral-500">
                  <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p class="text-lg mb-1">No items yet</p>
                  <p class="text-sm text-neutral-600">Tap + Add to get started</p>
                </div>
              }
            >
              <div class="grid grid-cols-4 gap-3">
                {/* Sort: collections first, then projects, then mixes - for optimal packing */}
                <For each={[...filteredEntries()].sort((a, b) => {
                  const order = { collection: 0, project: 1, mix: 2, unknown: 3 };
                  return (order[a.entry_type] || 3) - (order[b.entry_type] || 3);
                })}>
                  {(entry) => {
                    const isFolder = entry.entry_type === "collection";
                    const isMix = entry.entry_type === "mix";
                    const isProject = entry.entry_type === "project";

                    return (
                      <div class={isMix ? "col-span-1" : "col-span-2"}>
                        <Show when={isMix}>
                          {/* Mix: Square card with waveform pattern */}
                          <div class="relative group">
                            <button
                              onClick={() => handleEntryClick(entry)}
                              class="w-full aspect-square rounded-xl bg-neutral-900 shadow-card flex items-center justify-center relative overflow-hidden mb-1.5"
                            >
                              {/* Waveform bars pattern - neutral gray */}
                              <div class="absolute inset-0 flex items-center justify-center gap-0.5 px-2">
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 24%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 42%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 30%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 54%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 36%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 48%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 30%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 42%" />
                                <div class="w-1 bg-neutral-700 rounded-full" style="height: 24%" />
                              </div>
                              {/* Play button overlay */}
                              <div class="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                <svg class="w-3 h-3 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5.14v14l11-7-11-7z" />
                                </svg>
                              </div>
                            </button>
                            {/* Menu button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuEntry(entry);
                              }}
                              class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                              <svg class="w-2.5 h-2.5 text-neutral-300" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="6" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="18" r="2" />
                              </svg>
                            </button>
                          </div>
                          <div class="text-center">
                            <div class="text-xs font-medium truncate px-0.5 text-neutral-200">{entry.name}</div>
                          </div>
                        </Show>

                        <Show when={!isMix}>
                          {/* Projects and Collections: Clean card with icon */}
                          <button
                            onClick={() => handleEntryClick(entry)}
                            class="relative w-full aspect-square rounded-xl overflow-hidden mb-1.5 bg-neutral-900 shadow-card"
                          >
                            {/* Collection: Show 2x2 grid of child previews or folder icon */}
                            <Show when={isFolder}>
                              <Show
                                when={entry.children && entry.children.length > 0}
                                fallback={
                                  <div class="absolute inset-0 flex items-center justify-center">
                                    <svg class="w-16 h-16 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                  </div>
                                }
                              >
                                <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-1">
                                  <For each={entry.children?.slice(0, 4)}>
                                    {(child) => {
                                      const isChildMix = child.entry_type === "mix";
                                      const isChildFolder = child.entry_type === "collection";

                                      return (
                                        <div class="rounded-md overflow-hidden flex items-center justify-center bg-neutral-800">
                                          <Show when={isChildMix}>
                                            <div class="flex items-center justify-center gap-px">
                                              <div class="w-0.5 bg-neutral-600 rounded-full" style="height: 20%" />
                                              <div class="w-0.5 bg-neutral-600 rounded-full" style="height: 35%" />
                                              <div class="w-0.5 bg-neutral-600 rounded-full" style="height: 45%" />
                                              <div class="w-0.5 bg-neutral-600 rounded-full" style="height: 30%" />
                                              <div class="w-0.5 bg-neutral-600 rounded-full" style="height: 20%" />
                                            </div>
                                          </Show>
                                          <Show when={isChildFolder}>
                                            <svg class="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                          </Show>
                                          <Show when={!isChildMix && !isChildFolder}>
                                            <svg class="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                          </Show>
                                        </div>
                                      );
                                    }}
                                  </For>
                                  {/* Fill empty slots */}
                                  <For each={Array(Math.max(0, 4 - (entry.children?.length || 0))).fill(0)}>
                                    {() => <div class="rounded-md bg-neutral-800/50" />}
                                  </For>
                                </div>
                              </Show>
                            </Show>

                            {/* Project: Show project icon */}
                            <Show when={isProject}>
                              <div class="absolute inset-0 flex items-center justify-center">
                                <svg class="w-16 h-16 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                              </div>
                              {/* Play button for projects */}
                              <div class="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <svg class="w-5 h-5 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5.14v14l11-7-11-7z" />
                                </svg>
                              </div>
                            </Show>
                          </button>

                          {/* Info below card */}
                          <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                              <div class="text-sm font-semibold truncate text-neutral-200">{entry.name}</div>
                              <div class="text-xs text-neutral-500">
                                <Show when={entry.entry_type === "collection"}>
                                  {entry.children?.length || 0} items
                                </Show>
                                <Show when={entry.entry_type === "project"}>
                                  Project
                                </Show>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuEntry(entry);
                              }}
                              class="w-8 h-8 flex items-center justify-center text-neutral-500"
                            >
                              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="5" cy="12" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="19" cy="12" r="1.5" />
                              </svg>
                            </button>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>

        </div>
      </Show>

      {/* Floating Add Button - iOS style */}
      <Show when={view() === "browser"}>
        <div
          class="fixed left-1/2 -translate-x-1/2 z-50"
          style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={() => setIsCreating("select")}
            class="px-6 py-3 rounded-full bg-neutral-800 text-white font-medium flex items-center gap-2 shadow-elevated"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </Show>

      {/* Project View - Clean minimal style */}
      <Show when={view() === "project"}>
        <div
          class="h-full flex flex-col bg-black"
          style={{
            "padding-top": "env(safe-area-inset-top, 0px)",
            "padding-bottom": "env(safe-area-inset-bottom, 0px)"
          }}
        >
          {/* Header with back button */}
          <div class="flex items-center px-4 py-3">
            <button
              onClick={navigateBackFromProject}
              class="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center"
            >
              <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div class="flex-1 overflow-y-auto">
            {/* Clean project artwork - simple dark card */}
            <div class="px-8 pb-6">
              <div class="aspect-square w-full max-w-[280px] mx-auto rounded-xl shadow-elevated bg-neutral-900 flex items-center justify-center">
                <svg class="w-24 h-24 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>

            {/* Project info */}
            <div class="px-4 pb-4">
              <div class="flex items-end justify-between">
                <div class="flex-1">
                  <h1 class="text-2xl font-bold mb-1">{currentProject()?.name || "Project"}</h1>
                  <p class="text-sm text-neutral-500">
                    {mixEntries().length} mixes
                  </p>
                </div>
                <button class="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-card">
                  <svg class="w-7 h-7 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add mix button */}
            <div class="px-4 pb-4">
              <button
                onClick={() => setIsCreating("mix")}
                class="w-full py-3 rounded-xl bg-neutral-900 text-neutral-300 font-medium flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add mix
              </button>
            </div>

            {/* Mix list */}
            <div class="px-4">
              <Show
                when={mixEntries().length > 0}
                fallback={
                  <div class="text-center py-12 text-neutral-500">
                    <p class="text-sm">No mixes yet</p>
                    <p class="text-xs mt-1 text-neutral-600">Tap "Add mix" to create your first recording</p>
                  </div>
                }
              >
                <For each={mixEntries()}>
                  {(entry, idx) => (
                    <div class="w-full flex items-center gap-3 py-2">
                      <span class="w-6 text-center text-neutral-600 text-sm">{idx() + 1}</span>
                      {/* Play button */}
                      <button
                        onClick={() => handleEntryClick(entry)}
                        class="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center"
                      >
                        <svg class="w-4 h-4 ml-0.5 text-neutral-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      </button>
                      <div
                        onClick={() => handleEntryClick(entry)}
                        class="flex-1 cursor-pointer"
                      >
                        <div class="font-medium text-neutral-200">{entry.name}</div>
                        <div class="text-sm text-neutral-500 flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {entry.modified_at ? new Date(entry.modified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuEntry(entry);
                        }}
                        class="w-8 h-8 flex items-center justify-center text-neutral-600"
                      >
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Create Modal - Type Selection - Clean iOS style */}
      <Show when={isCreating() === "select"}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div class="bg-neutral-900 rounded-t-2xl w-full max-w-md p-5 pb-8">
            <div class="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-4" />
            <h2 class="text-lg font-semibold mb-4 text-center">Create New</h2>
            <div class="space-y-2">
              <button
                onClick={() => setIsCreating("mix")}
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4"
              >
                <div class="w-12 h-12 rounded-xl bg-neutral-700 flex items-center justify-center">
                  <svg class="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <div class="font-semibold text-neutral-200">Mix</div>
                  <div class="text-sm text-neutral-500">Start a new recording</div>
                </div>
              </button>
              <button
                onClick={() => setIsCreating("project")}
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4"
              >
                <div class="w-12 h-12 rounded-xl bg-neutral-700 flex items-center justify-center">
                  <svg class="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <div class="font-semibold text-neutral-200">Project</div>
                  <div class="text-sm text-neutral-500">Group related mixes together</div>
                </div>
              </button>
              <button
                onClick={() => setIsCreating("collection")}
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4"
              >
                <div class="w-12 h-12 rounded-xl bg-neutral-700 flex items-center justify-center">
                  <svg class="w-6 h-6 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <div class="font-semibold text-neutral-200">Collection</div>
                  <div class="text-sm text-neutral-500">Organize projects and mixes</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setIsCreating(null)}
              class="w-full mt-4 py-3 rounded-xl bg-neutral-800 text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Create Modal - Name Input */}
      <Show when={isCreating() && isCreating() !== "select"}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div class="bg-neutral-900 rounded-2xl w-full max-w-sm p-5">
            <h2 class="text-lg font-semibold mb-3 text-neutral-200">
              New {isCreating() === "collection" ? "Collection" : isCreating() === "project" ? "Project" : "Mix"}
            </h2>
            <input
              type="text"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreate()}
              placeholder={
                isCreating() === "collection" ? "Collection name..." :
                isCreating() === "project" ? "Project name..." :
                "Mix name..."
              }
              class="w-full px-4 py-3 bg-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              autofocus
            />
            <div class="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setIsCreating(null);
                  setNewName("");
                }}
                class="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName().trim()}
                class="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Context Menu - Clean style */}
      <Show when={menuEntry()}>
        <div
          class="fixed inset-0 z-50"
          onClick={() => setMenuEntry(null)}
        >
          <div class="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl p-4 pb-8">
            <div class="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-4" />
            <h3 class="font-semibold mb-4 text-center text-neutral-200">{menuEntry()?.name}</h3>
            <div class="space-y-2">
              {/* Export Mix - only for mix entries */}
              <Show when={menuEntry()?.entry_type === "mix"}>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const entry = menuEntry();
                    if (!entry) return;
                    try {
                      // Load the mix to get track info
                      const mixData = await invoke<any>("load_mix", { mixPath: entry.path });
                      const tracks = mixData.tracks
                        .filter((t: any) => t.clip)
                        .map((t: any) => ({
                          path: `${entry.path}/${t.clip.audio_file}`,
                          volume: t.volume,
                          muted: t.muted,
                        }));

                      if (tracks.length === 0) {
                        alert("No tracks to export");
                        return;
                      }

                      const outputPath = `${entry.path}/export_${Date.now()}.wav`;
                      await invoke("export_and_share", {
                        tracks,
                        outputPath,
                        sampleRate: 48000,
                      });
                    } catch (err) {
                      alert(`Export failed: ${err}`);
                    }
                    setMenuEntry(null);
                  }}
                  class="w-full py-3 rounded-xl bg-neutral-800 text-blue-400 font-medium flex items-center justify-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export Mix
                </button>
              </Show>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(menuEntry());
                  setMenuEntry(null);
                }}
                class="w-full py-3 rounded-xl bg-neutral-800 text-destructive font-medium flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Move to Trash
              </button>
              <button
                onClick={() => setMenuEntry(null)}
                class="w-full py-3 rounded-xl bg-neutral-800 text-neutral-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Delete Confirmation */}
      <Show when={confirmDelete()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div class="bg-neutral-900 rounded-2xl w-full max-w-sm p-5">
            <h2 class="text-lg font-semibold mb-2 text-neutral-200">Delete "{confirmDelete()?.name}"?</h2>
            <p class="text-sm text-neutral-500 mb-4">
              This will move the {getTypeLabel(confirmDelete()?.entry_type || "")} to your Trash. You can restore it from there if needed.
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting()}
                class="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const entry = confirmDelete();
                  if (entry) handleDelete(entry);
                }}
                disabled={isDeleting()}
                class="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-50"
              >
                {isDeleting() ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </Show>

    </div>
  );
};

export default App;
