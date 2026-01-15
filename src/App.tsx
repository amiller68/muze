import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { type Component, createSignal, For, onMount, Show } from "solid-js";
import { DropboxFolderPicker } from "./components/DropboxFolderPicker";
import { EmptyState } from "./components/editor/EmptyState";
import { MixEditor } from "./components/editor/MixEditor";
import { Sidebar } from "./components/sidebar";
import { useDropboxStore } from "./stores/dropboxStore";
import { useMixStore } from "./stores/mixStore";
import { useVaultStore } from "./stores/vaultStore";
import type { Mix, Track } from "./types/mix";
import type { FolderEntry } from "./types/navigation";

// Extended entry with children for tree view
interface EntryWithChildren extends FolderEntry {
  children?: FolderEntry[];
}

// View modes: browser (collections/mixes), editor (mix editing)
type ViewMode = "browser" | "editor";

const App: Component = () => {
  const store = useMixStore();
  const vaultStore = useVaultStore();
  const dropboxStore = useDropboxStore();
  const [view, setView] = createSignal<ViewMode>("browser");
  const [currentPath, setCurrentPath] = createSignal<string>("");
  const [pathStack, setPathStack] = createSignal<string[]>([]);
  const [entries, setEntries] = createSignal<EntryWithChildren[]>([]);
  const [isCreating, setIsCreating] = createSignal<"mix" | "collection" | "select" | null>(null);
  const [newName, setNewName] = createSignal("");
  const [menuEntry, setMenuEntry] = createSignal<FolderEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<FolderEntry | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showSearch, setShowSearch] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [showVaultPicker, setShowVaultPicker] = createSignal(false);

  // Dropbox integration state
  const [showAddVault, setShowAddVault] = createSignal(false);
  const [showDropboxFolderPicker, setShowDropboxFolderPicker] = createSignal(false);
  const [newVaultName, setNewVaultName] = createSignal("");

  // Desktop file tree state
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = createSignal<Map<string, FolderEntry[]>>(new Map());
  const [selectedPaths, setSelectedPaths] = createSignal<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = createSignal<string | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = createSignal(false);

  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    entry: FolderEntry | null;
  } | null>(null);
  const [createTargetPath, setCreateTargetPath] = createSignal<string | null>(null);

  // Drag-drop state (desktop)
  const [draggedPaths, setDraggedPaths] = createSignal<string[]>([]);
  const [_dropTarget, setDropTarget] = createSignal<string | null>(null);

  // Drag-drop state (mobile)
  const [mobileDragEntry, setMobileDragEntry] = createSignal<FolderEntry | null>(null);
  const [mobileDragPos, setMobileDragPos] = createSignal<{ x: number; y: number } | null>(null);
  const [mobileDropTarget, setMobileDropTarget] = createSignal<string | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchStartPos: { x: number; y: number } | null = null;

  // Check if we're on mobile (< 768px)
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768);

  onMount(async () => {
    // Listen for resize events
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

    // Listen for clicks to close context menu
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);

    // Listen for Delete/Backspace key for deleting selected items (desktop only)
    // and Escape to close context menu
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes context menu
      if (e.key === "Escape") {
        setContextMenu(null);
        return;
      }

      if (isMobile()) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPaths().size > 0) {
        // Don't trigger when typing in an input
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        e.preventDefault();
        setConfirmDeleteSelected(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    try {
      // Load vaults first, then use active vault path
      await vaultStore.loadVaults();
      const path = await vaultStore.getActiveVaultPath();
      setCurrentPath(path);
      setPathStack([path]);
      await refreshEntries(path);
    } catch (e) {
      console.error("Failed to initialize:", e);
      // Fallback to default path if vault loading fails
      try {
        const path = await invoke<string>("get_default_projects_path");
        setCurrentPath(path);
        setPathStack([path]);
        await refreshEntries(path);
      } catch (fallbackError) {
        console.error("Failed to get fallback path:", fallbackError);
      }
    }
  });

  const refreshEntries = async (path: string) => {
    try {
      const items = await invoke<FolderEntry[]>("list_entries", { path });

      // Load one level of children for collections (for mobile preview)
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
        }),
      );

      setEntries(entriesWithChildren);

      // Also update children map for desktop tree
      const newMap = new Map(childrenMap());
      newMap.set(path, items);
      setChildrenMap(newMap);
    } catch (e) {
      console.error("Failed to list entries:", e);
    }
  };

  // Load children for a folder (for desktop tree)
  const loadChildrenFor = async (folderPath: string) => {
    try {
      const items = await invoke<FolderEntry[]>("list_entries", { path: folderPath });
      const newMap = new Map(childrenMap());
      newMap.set(folderPath, items);
      setChildrenMap(newMap);
    } catch (e) {
      console.error("Failed to load children:", e);
    }
  };

  // Get children for a path (for tree view)
  const getChildren = (path: string): FolderEntry[] | undefined => {
    return childrenMap().get(path);
  };

  // Get all visible mix paths in order (for shift-click range selection)
  const getVisibleMixPaths = (): string[] => {
    const result: string[] = [];
    const sortEntries = (items: FolderEntry[]): FolderEntry[] => {
      const order: Record<string, number> = { collection: 0, mix: 1, unknown: 2 };
      return [...items].sort((a, b) => {
        const orderDiff = (order[a.entry_type] ?? 2) - (order[b.entry_type] ?? 2);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });
    };

    const traverse = (items: FolderEntry[]) => {
      for (const item of sortEntries(items)) {
        if (item.entry_type === "mix") {
          result.push(item.path);
        } else if (item.entry_type === "collection" && expandedPaths().has(item.path)) {
          const children = childrenMap().get(item.path);
          if (children) {
            traverse(children);
          }
        }
      }
    };

    traverse(entries());
    return result;
  };

  // Handle tree expand/collapse
  const handleToggleExpand = async (path: string) => {
    const newSet = new Set(expandedPaths());
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
      // Load children if not already loaded
      if (!childrenMap().has(path)) {
        await loadChildrenFor(path);
      }
    }
    setExpandedPaths(newSet);
  };

  // Handle tree item selection (desktop) with multi-select
  const handleTreeSelect = async (
    entry: FolderEntry,
    modifiers: { shift: boolean; meta: boolean },
  ) => {
    if (entry.entry_type !== "mix") return;

    if (modifiers.shift && lastSelectedPath()) {
      // Range select: select all items between last and current
      const visiblePaths = getVisibleMixPaths();
      const lastIdx = visiblePaths.indexOf(lastSelectedPath()!);
      const currentIdx = visiblePaths.indexOf(entry.path);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangePaths = visiblePaths.slice(start, end + 1);

        const newSet = new Set(selectedPaths());
        for (const p of rangePaths) {
          newSet.add(p);
        }
        setSelectedPaths(newSet);
      }
    } else if (modifiers.meta) {
      // Toggle: add/remove from selection
      const newSet = new Set(selectedPaths());
      if (newSet.has(entry.path)) {
        newSet.delete(entry.path);
      } else {
        newSet.add(entry.path);
      }
      setSelectedPaths(newSet);
      setLastSelectedPath(entry.path);
    } else {
      // Normal click: select only this item and load it
      setSelectedPaths(new Set([entry.path]));
      setLastSelectedPath(entry.path);

      try {
        await store.loadMix(entry.path);
      } catch (e) {
        console.error("Failed to load mix:", e);
        setSelectedPaths(new Set());
      }
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
      store.loadMix(entry.path).catch((e) => {
        console.error("Failed to load mix:", e);
        setView("browser");
      });
    } else if (entry.entry_type === "collection") {
      // Navigate into collection
      await navigateTo(entry.path);
    }
  };

  const handleCreate = async () => {
    const name = newName().trim();
    const type = isCreating();
    if (!name || !type) return;

    // Use target path if set (from context menu), otherwise current path
    const targetPath = createTargetPath() || currentPath();

    try {
      if (type === "collection") {
        await invoke("create_collection", { name, parentPath: targetPath });
        // Refresh both current view and target if different
        await refreshEntries(currentPath());
        if (targetPath !== currentPath() && childrenMap().has(targetPath)) {
          const items = await invoke<FolderEntry[]>("list_entries", { path: targetPath });
          const newMap = new Map(childrenMap());
          newMap.set(targetPath, items);
          setChildrenMap(newMap);
        }
      } else if (type === "mix") {
        await store.createMix(name, targetPath);
        if (isMobile()) {
          setView("editor");
        } else {
          // Desktop: select the new mix in tree
          const mixPath = store.mixPath();
          if (mixPath) {
            setSelectedPaths(new Set([mixPath]));
            setLastSelectedPath(mixPath);
          }
          // Refresh target folder if it's loaded
          if (targetPath !== currentPath() && childrenMap().has(targetPath)) {
            const items = await invoke<FolderEntry[]>("list_entries", { path: targetPath });
            const newMap = new Map(childrenMap());
            newMap.set(targetPath, items);
            setChildrenMap(newMap);
          }
        }
      }
      setNewName("");
      setIsCreating(null);
      setCreateTargetPath(null);
    } catch (e) {
      console.error("Failed to create:", e);
    }
  };

  // Create an untitled mix and start recording (for empty state)
  const handleAutoCreateAndRecord = async () => {
    try {
      // Find a unique name
      const vaultPath = await vaultStore.getActiveVaultPath();
      let name = "Untitled";
      let counter = 1;

      // Check existing mixes to find unique name
      const existing = entries().filter((e) => e.entry_type === "mix");
      const existingNames = new Set(existing.map((e) => e.name));
      while (existingNames.has(name)) {
        counter++;
        name = `Untitled ${counter}`;
      }

      // Create the mix
      await store.createMix(name, vaultPath);

      // Refresh entries for tree
      await refreshEntries(vaultPath);

      // Select the new mix
      const mixPath = store.mixPath();
      if (mixPath) {
        setSelectedPaths(new Set([mixPath]));
        setLastSelectedPath(mixPath);
      }
    } catch (e) {
      console.error("Failed to auto-create mix:", e);
    }
  };

  // Create new mix from empty state (desktop)
  const handleCreateNewMix = () => {
    setIsCreating("mix");
  };

  const handleDone = async () => {
    try {
      await store.saveMix();
    } catch (e) {
      console.error("Save failed:", e);
    }

    if (isMobile()) {
      await refreshEntries(currentPath());
      setView("browser");
    }
    // On desktop, don't change view - mix stays in editor
  };

  const handleDelete = async (entry: FolderEntry) => {
    setIsDeleting(true);
    try {
      await invoke("delete_entry", { entryPath: entry.path });
      setConfirmDelete(null);
      setMenuEntry(null);
      await refreshEntries(currentPath());
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
      case "collection":
        return "Collection";
      case "mix":
        return "Mix";
      default:
        return "";
    }
  };

  // Filter entries based on search query
  const filteredEntries = () => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return entries();
    return entries().filter((e) => e.name.toLowerCase().includes(query));
  };

  // Switch to a different vault
  const handleVaultSwitch = async (vaultId: string) => {
    if (vaultId !== vaultStore.activeVault()?.id) {
      await vaultStore.switchVault(vaultId);
      const path = await vaultStore.getActiveVaultPath();
      setCurrentPath(path);
      setPathStack([path]);
      setView("browser");
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
      store.clearMix();
      // Reset tree state
      setExpandedPaths(new Set());
      setChildrenMap(new Map());
      await refreshEntries(path);
    }
    setShowVaultPicker(false);
  };

  // Start Dropbox OAuth flow
  const handleConnectDropbox = async () => {
    try {
      const authUrl = await dropboxStore.startAuth();
      // Open in system browser for OAuth
      await open(authUrl);
      // Note: The OAuth redirect will need to be handled via deep link
      // For now, we'll show a manual code entry dialog or handle via deep link plugin
    } catch (e) {
      console.error("Failed to start Dropbox auth:", e);
    }
  };

  // Handle Dropbox folder selection (after OAuth complete)
  const handleDropboxFolderSelect = async (folderPath: string) => {
    try {
      const name = newVaultName() || "Dropbox";
      await vaultStore.createVault(name, "dropbox", folderPath);
      await vaultStore.loadVaults();
      setShowDropboxFolderPicker(false);
      setShowAddVault(false);
      setNewVaultName("");
    } catch (e) {
      console.error("Failed to create Dropbox vault:", e);
    }
  };

  // Cancel Dropbox folder picker
  const handleDropboxFolderCancel = () => {
    setShowDropboxFolderPicker(false);
    dropboxStore.cancelAuth();
  };

  // Delete selected items (desktop)
  const handleDeleteSelected = async () => {
    const paths = Array.from(selectedPaths());
    if (paths.length === 0) return;

    setIsDeleting(true);
    try {
      for (const path of paths) {
        await invoke("delete_entry", { entryPath: path });
      }
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
      setConfirmDeleteSelected(false);
      store.clearMix();
      await refreshEntries(currentPath());
    } catch (e) {
      console.error("Delete failed:", e);
      alert(`Failed to delete: ${e}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Context menu handler (desktop)
  const handleContextMenu = (entry: FolderEntry | null, x: number, y: number) => {
    // If right-clicking on an item that's not in selection, select it
    if (entry && !selectedPaths().has(entry.path)) {
      setSelectedPaths(new Set([entry.path]));
      setLastSelectedPath(entry.path);
    }
    setContextMenu({ x, y, entry });
  };

  // Context menu action: create mix/collection in folder
  const handleCreateInFolder = (type: "mix" | "collection", folderPath: string) => {
    setCreateTargetPath(folderPath);
    setIsCreating(type);
    setContextMenu(null);
  };

  // Context menu action: delete selected
  const handleContextDelete = () => {
    setContextMenu(null);
    if (selectedPaths().size > 0) {
      setConfirmDeleteSelected(true);
    }
  };

  // Drag-drop handlers
  const handleDragStart = (entry: FolderEntry) => {
    // If dragging something not in selection, drag only that item
    if (selectedPaths().has(entry.path)) {
      setDraggedPaths(Array.from(selectedPaths()));
    } else {
      setDraggedPaths([entry.path]);
    }
  };

  const handleDragOver = (entry: FolderEntry | null) => {
    if (entry) {
      setDropTarget(entry.path);
    } else {
      // Dropping on root (vault path)
      setDropTarget(currentPath());
    }
  };

  const handleDrop = async (targetEntry: FolderEntry | null) => {
    const targetPath = targetEntry ? targetEntry.path : currentPath();
    const paths = draggedPaths();

    if (paths.length === 0) {
      setDraggedPaths([]);
      setDropTarget(null);
      return;
    }

    // Don't drop onto self or own children
    for (const sourcePath of paths) {
      if (targetPath === sourcePath || targetPath.startsWith(`${sourcePath}/`)) {
        setDraggedPaths([]);
        setDropTarget(null);
        return;
      }
    }

    try {
      for (const sourcePath of paths) {
        await invoke("move_entry", { sourcePath, destFolder: targetPath });
      }
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
      await refreshEntries(currentPath());
      // Also refresh destination if it's loaded
      if (childrenMap().has(targetPath)) {
        const items = await invoke<FolderEntry[]>("list_entries", { path: targetPath });
        const newMap = new Map(childrenMap());
        newMap.set(targetPath, items);
        setChildrenMap(newMap);
      }
    } catch (e) {
      console.error("Move failed:", e);
      alert(`Failed to move: ${e}`);
    } finally {
      setDraggedPaths([]);
      setDropTarget(null);
    }
  };

  // Mobile drag-drop handlers
  const handleMobileTouchStart = (entry: FolderEntry, e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };

    // Start long press timer (500ms to initiate drag)
    longPressTimer = setTimeout(() => {
      setMobileDragEntry(entry);
      setMobileDragPos({ x: touch.clientX, y: touch.clientY });
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleMobileTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];

    // If we haven't started dragging yet, check if we moved too far (cancel long press)
    if (!mobileDragEntry() && touchStartPos) {
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        // User is scrolling, cancel long press
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }
    }

    // If we're dragging, update position and find drop target
    if (mobileDragEntry()) {
      e.preventDefault(); // Prevent scrolling while dragging
      setMobileDragPos({ x: touch.clientX, y: touch.clientY });

      // Find element under touch point
      const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTargetEl = elemBelow?.closest("[data-drop-target]");

      if (dropTargetEl) {
        const targetPath = dropTargetEl.getAttribute("data-drop-target");
        // Can't drop onto self
        if (targetPath && targetPath !== mobileDragEntry()?.path) {
          setMobileDropTarget(targetPath);
        } else {
          setMobileDropTarget(null);
        }
      } else {
        setMobileDropTarget(null);
      }
    }
  };

  const handleMobileTouchEnd = async () => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    touchStartPos = null;

    const dragEntry = mobileDragEntry();
    const dropPath = mobileDropTarget();

    // Reset drag state
    setMobileDragEntry(null);
    setMobileDragPos(null);
    setMobileDropTarget(null);

    // Execute move if we have valid source and target
    if (dragEntry && dropPath) {
      try {
        await invoke("move_entry", {
          sourcePath: dragEntry.path,
          destFolder: dropPath,
        });
        await refreshEntries(currentPath());
      } catch (e) {
        console.error("Move failed:", e);
        alert(`Failed to move: ${e}`);
      }
    }
  };

  const handleMobileTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    touchStartPos = null;
    setMobileDragEntry(null);
    setMobileDragPos(null);
    setMobileDropTarget(null);
  };

  return (
    <div class="h-screen bg-black text-white">
      {/* ===== DESKTOP LAYOUT (md: and up) ===== */}
      <Show when={!isMobile()}>
        <div class="h-full flex">
          {/* Sidebar with file tree */}
          <Sidebar
            entries={entries()}
            expandedPaths={expandedPaths()}
            selectedPaths={selectedPaths()}
            onToggleExpand={handleToggleExpand}
            onSelect={handleTreeSelect}
            getChildren={getChildren}
            activeVault={vaultStore.activeVault()}
            onManageVaults={() => setShowVaultPicker(true)}
            onDeleteSelected={() => setConfirmDeleteSelected(true)}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />

          {/* Main Content Area */}
          <div class="flex-1 flex flex-col min-w-0">
            <Show
              when={store.currentMix()}
              fallback={
                <EmptyState onRecord={handleAutoCreateAndRecord} onCreateNew={handleCreateNewMix} />
              }
            >
              <MixEditor onDone={handleDone} inline />
            </Show>
          </div>
        </div>
      </Show>

      {/* ===== MOBILE LAYOUT ===== */}
      <Show when={isMobile()}>
        <Show when={view() === "editor"}>
          <Show
            when={store.currentMix()}
            fallback={
              <div class="h-full flex items-center justify-center bg-black">
                <div class="text-neutral-400">Loading...</div>
              </div>
            }
          >
            <MixEditor onDone={handleDone} breadcrumb={currentFolderName()} />
          </Show>
        </Show>

        <Show when={view() === "browser"}>
          <div
            class="h-full flex flex-col bg-black"
            style={{
              "padding-top": "env(safe-area-inset-top, 0px)",
              "padding-bottom": "env(safe-area-inset-bottom, 0px)",
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
                      <svg
                        class="w-5 h-5 text-neutral-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                  </Show>
                  <div class="flex-1 min-w-0">
                    <h1 class="text-2xl font-bold truncate">{currentFolderName()}</h1>
                    {/* Vault indicator */}
                    <Show when={vaultStore.activeVault()}>
                      <button
                        onClick={() => setShowVaultPicker(true)}
                        class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-400"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                          />
                        </svg>
                        <span>{vaultStore.activeVault()?.name}</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </Show>
                  </div>
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
                    <svg
                      class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
              </Show>
              {/* Search button */}
              <button
                onClick={() => {
                  setShowSearch(!showSearch());
                  if (showSearch()) setSearchQuery("");
                }}
                class="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0"
              >
                <Show when={!showSearch()}>
                  <svg
                    class="w-5 h-5 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </Show>
                <Show when={showSearch()}>
                  <svg
                    class="w-5 h-5 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Show>
              </button>
            </div>

            {/* List View */}
            <div class="flex-1 overflow-y-auto pb-24">
              <Show
                when={entries().length > 0}
                fallback={
                  <div class="flex flex-col items-center justify-center h-full text-neutral-500">
                    <svg
                      class="w-16 h-16 mb-4 opacity-30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1"
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <p class="text-lg mb-1">No items yet</p>
                    <p class="text-sm text-neutral-600">Tap + Add to get started</p>
                  </div>
                }
              >
                <div class="divide-y divide-neutral-800">
                  {/* Sort: collections first, then mixes, alphabetically within each */}
                  <For
                    each={[...filteredEntries()].sort((a, b) => {
                      const order = { collection: 0, mix: 1, unknown: 2 };
                      const orderDiff = (order[a.entry_type] || 2) - (order[b.entry_type] || 2);
                      if (orderDiff !== 0) return orderDiff;
                      return a.name.localeCompare(b.name);
                    })}
                  >
                    {(entry) => {
                      const isFolder = entry.entry_type === "collection";
                      const isMix = entry.entry_type === "mix";
                      const isDragging = () => mobileDragEntry()?.path === entry.path;
                      const isDropTarget = () => mobileDropTarget() === entry.path;

                      return (
                        <div
                          class={`flex items-center gap-3 px-4 py-3 active:bg-neutral-900 transition-all ${
                            isDragging() ? "opacity-50" : ""
                          } ${isDropTarget() ? "bg-blue-500/20 ring-2 ring-blue-500 ring-inset" : ""}`}
                          data-drop-target={isFolder ? entry.path : undefined}
                          onClick={() => !mobileDragEntry() && handleEntryClick(entry)}
                          onTouchStart={(e) => handleMobileTouchStart(entry, e)}
                          onTouchMove={handleMobileTouchMove}
                          onTouchEnd={handleMobileTouchEnd}
                          onTouchCancel={handleMobileTouchCancel}
                        >
                          {/* Icon */}
                          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-neutral-800">
                            <Show when={isMix}>
                              <svg
                                class="w-6 h-6 text-neutral-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                                />
                              </svg>
                            </Show>
                            <Show when={isFolder}>
                              <svg
                                class="w-6 h-6 text-neutral-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="1.5"
                                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                />
                              </svg>
                            </Show>
                          </div>

                          {/* Content */}
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-neutral-200 truncate">{entry.name}</div>
                            <div class="text-sm text-neutral-500">
                              <Show when={isFolder}>{entry.children?.length || 0} items</Show>
                              <Show when={isMix}>
                                {entry.modified_at
                                  ? new Date(entry.modified_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "Mix"}
                              </Show>
                            </div>
                          </div>

                          {/* Chevron for collections, play for mixes */}
                          <Show when={!isMix}>
                            <svg
                              class="w-5 h-5 text-neutral-600"
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
                          </Show>
                          <Show when={isMix}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEntryClick(entry);
                              }}
                              class="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center"
                            >
                              <svg
                                class="w-4 h-4 ml-0.5 text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5.14v14l11-7-11-7z" />
                              </svg>
                            </button>
                          </Show>

                          {/* Menu button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuEntry(entry);
                            }}
                            class="w-8 h-8 flex items-center justify-center text-neutral-600"
                          >
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="6" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="18" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* Floating Add Button */}
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
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </button>
          </div>
        </Show>

        {/* Mobile Drag Ghost - floating element that follows finger */}
        <Show when={mobileDragEntry() && mobileDragPos()}>
          {(_) => {
            const entry = mobileDragEntry()!;
            const pos = mobileDragPos()!;
            const isMixEntry = entry.entry_type === "mix";
            return (
              <div
                class="fixed z-[100] pointer-events-none"
                style={{
                  left: `${pos.x - 30}px`,
                  top: `${pos.y - 30}px`,
                }}
              >
                <div class="w-16 h-16 rounded-2xl bg-neutral-800 border-2 border-blue-500 shadow-xl flex flex-col items-center justify-center">
                  <Show when={isMixEntry}>
                    <svg
                      class="w-6 h-6 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                  </Show>
                  <Show when={!isMixEntry}>
                    <svg
                      class="w-6 h-6 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </Show>
                  <span class="text-[10px] text-neutral-400 mt-0.5 truncate max-w-14 px-1">
                    {entry.name}
                  </span>
                </div>
              </div>
            );
          }}
        </Show>
      </Show>

      {/* ===== DESKTOP CONTEXT MENU ===== */}
      <Show when={contextMenu()}>
        {(menu) => {
          const entry = menu().entry;
          const isCollection = entry?.entry_type === "collection";
          const hasSelection = selectedPaths().size > 0;

          return (
            <div
              class="fixed z-50 bg-neutral-800 rounded-lg shadow-lg py-1 min-w-[160px] border border-neutral-700"
              style={{
                left: `${menu().x}px`,
                top: `${menu().y}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Create options - show when right-clicking on collection or empty area */}
              <Show when={isCollection || !entry}>
                <button
                  onClick={() => handleCreateInFolder("mix", entry?.path || currentPath())}
                  class="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                    />
                  </svg>
                  New Mix Here
                </button>
                <button
                  onClick={() => handleCreateInFolder("collection", entry?.path || currentPath())}
                  class="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  New Collection Here
                </button>
                <Show when={hasSelection}>
                  <div class="border-t border-neutral-700 my-1" />
                </Show>
              </Show>

              {/* Delete option - show when items are selected */}
              <Show when={hasSelection}>
                <button
                  onClick={handleContextDelete}
                  class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete{selectedPaths().size > 1 ? ` (${selectedPaths().size})` : ""}
                </button>
              </Show>
            </div>
          );
        }}
      </Show>

      {/* ===== MODALS (shared by both layouts) ===== */}

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
                  <svg
                    class="w-6 h-6 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>
                <div>
                  <div class="font-semibold text-neutral-200">Mix</div>
                  <div class="text-sm text-neutral-500">Start a new recording</div>
                </div>
              </button>
              <button
                onClick={() => setIsCreating("collection")}
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4"
              >
                <div class="w-12 h-12 rounded-xl bg-neutral-700 flex items-center justify-center">
                  <svg
                    class="w-6 h-6 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
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
        <div class="fixed inset-0 bg-black/80 z-50 p-4 overflow-y-auto">
          <div class="min-h-full flex items-center justify-center">
            <div class="bg-neutral-900 rounded-2xl w-full max-w-sm p-5 my-auto">
              <h2 class="text-lg font-semibold mb-3 text-neutral-200">
                New {isCreating() === "collection" ? "Collection" : "Mix"}
              </h2>
              <input
                type="text"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreate()}
                placeholder={isCreating() === "collection" ? "Collection name..." : "Mix name..."}
                class="relative w-full px-4 py-3 bg-neutral-800 rounded-lg text-white placeholder-neutral-500 border border-neutral-700"
                style={{ "z-index": 1 }}
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
        </div>
      </Show>

      {/* Context Menu - Clean style */}
      <Show when={menuEntry()}>
        <div class="fixed inset-0 z-50" onClick={() => setMenuEntry(null)}>
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
                      const mixData = await invoke<Mix>("load_mix", { mixPath: entry.path });
                      const tracks = mixData.tracks
                        .filter(
                          (t): t is Track & { clip: NonNullable<Track["clip"]> } => t.clip !== null,
                        )
                        .map((t) => ({
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
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
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
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
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
            <h2 class="text-lg font-semibold mb-2 text-neutral-200">
              Delete "{confirmDelete()?.name}"?
            </h2>
            <p class="text-sm text-neutral-500 mb-4">
              This will move the {getTypeLabel(confirmDelete()?.entry_type || "")} to your Trash.
              You can restore it from there if needed.
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

      {/* Multi-Delete Confirmation (desktop) */}
      <Show when={confirmDeleteSelected()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div class="bg-neutral-900 rounded-2xl w-full max-w-sm p-5">
            <h2 class="text-lg font-semibold mb-2 text-neutral-200">
              Delete {selectedPaths().size} item{selectedPaths().size !== 1 ? "s" : ""}?
            </h2>
            <p class="text-sm text-neutral-500 mb-4">
              This will move the selected items to your Trash. You can restore them from there if
              needed.
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setConfirmDeleteSelected(false)}
                disabled={isDeleting()}
                class="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting()}
                class="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-50"
              >
                {isDeleting() ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Vault Picker Modal */}
      <Show when={showVaultPicker()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div class="bg-neutral-900 rounded-t-2xl w-full max-w-md p-5 pb-8">
            <div class="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-4" />
            <h2 class="text-lg font-semibold mb-4 text-center">Select Vault</h2>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <For each={vaultStore.vaults()}>
                {(vault) => (
                  <button
                    onClick={() => handleVaultSwitch(vault.id)}
                    class={`w-full p-4 rounded-xl text-left flex items-center gap-4 ${
                      vault.id === vaultStore.activeVault()?.id
                        ? "bg-neutral-700"
                        : "bg-neutral-800"
                    }`}
                  >
                    <div class="w-10 h-10 rounded-lg bg-neutral-600 flex items-center justify-center">
                      <Show when={vault.provider === "local"}>
                        <svg
                          class="w-5 h-5 text-neutral-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                          />
                        </svg>
                      </Show>
                      <Show when={vault.provider === "icloud"}>
                        <svg
                          class="w-5 h-5 text-neutral-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                          />
                        </svg>
                      </Show>
                      <Show when={vault.provider === "dropbox"}>
                        <svg
                          class="w-5 h-5 text-neutral-300"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 6.134L6 10.5l6 4.366L6 19.232l-6-4.366L6 10.5 0 6.134l6-4.366 6 4.366zm0 0l6-4.366 6 4.366-6 4.366 6 4.366-6 4.366-6-4.366 6-4.366-6-4.366z" />
                        </svg>
                      </Show>
                    </div>
                    <div class="flex-1">
                      <div class="font-medium text-neutral-200">{vault.name}</div>
                      <div class="text-xs text-neutral-500 capitalize">{vault.provider}</div>
                    </div>
                    <Show when={vault.id === vaultStore.activeVault()?.id}>
                      <svg
                        class="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </Show>
                  </button>
                )}
              </For>
            </div>
            <div class="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowVaultPicker(false);
                  setShowAddVault(true);
                }}
                class="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
              >
                Add Vault
              </button>
              <button
                onClick={() => setShowVaultPicker(false)}
                class="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Add Vault Modal */}
      <Show when={showAddVault()}>
        <div class="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div class="bg-neutral-900 rounded-t-2xl w-full max-w-md p-5 pb-8">
            <div class="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-4" />
            <h2 class="text-lg font-semibold mb-4 text-center">Add Vault</h2>

            {/* Vault name input */}
            <input
              type="text"
              placeholder="Vault name (optional)"
              value={newVaultName()}
              onInput={(e) => setNewVaultName(e.currentTarget.value)}
              class="w-full px-4 py-3 rounded-xl bg-neutral-800 text-white placeholder-neutral-500 mb-4"
            />

            {/* Provider options */}
            <div class="space-y-2">
              {/* Dropbox option */}
              <button
                onClick={async () => {
                  const connected = await dropboxStore.checkConnection();
                  if (connected) {
                    setShowDropboxFolderPicker(true);
                  } else {
                    await handleConnectDropbox();
                  }
                }}
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4 hover:bg-neutral-700"
              >
                <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 6.134L6 10.5l6 4.366L6 19.232l-6-4.366L6 10.5 0 6.134l6-4.366 6 4.366zm0 0l6-4.366 6 4.366-6 4.366 6 4.366-6 4.366-6-4.366 6-4.366-6-4.366z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="font-medium text-neutral-200">Connect Dropbox</div>
                  <div class="text-xs text-neutral-500">
                    {dropboxStore.isConnected() ? "Connected - Select folder" : "Sign in to sync"}
                  </div>
                </div>
                <Show when={dropboxStore.isConnected()}>
                  <svg
                    class="w-5 h-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </Show>
              </button>

              {/* iCloud option (placeholder) */}
              <button
                class="w-full p-4 rounded-xl bg-neutral-800 text-left flex items-center gap-4 opacity-50 cursor-not-allowed"
                disabled
              >
                <div class="w-10 h-10 rounded-lg bg-neutral-600 flex items-center justify-center">
                  <svg
                    class="w-5 h-5 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="font-medium text-neutral-400">iCloud</div>
                  <div class="text-xs text-neutral-600">Coming soon</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                setShowAddVault(false);
                setNewVaultName("");
              }}
              class="w-full mt-4 py-3 rounded-xl bg-neutral-800 text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Dropbox Folder Picker */}
      <Show when={showDropboxFolderPicker()}>
        <DropboxFolderPicker
          onSelect={handleDropboxFolderSelect}
          onCancel={handleDropboxFolderCancel}
        />
      </Show>
    </div>
  );
};

export default App;
