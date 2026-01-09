import { createSignal, For, Show } from "solid-js";
import type { FolderEntry } from "../../types/navigation";

// Sort entries: collections first, then mixes
const sortEntries = (entries: FolderEntry[]): FolderEntry[] => {
  const order: Record<string, number> = { collection: 0, mix: 1, unknown: 2 };
  return [...entries].sort((a, b) => {
    const orderDiff = (order[a.entry_type] ?? 2) - (order[b.entry_type] ?? 2);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
};

export interface SelectModifiers {
  shift: boolean;
  meta: boolean;
}

interface FileTreeProps {
  entries: FolderEntry[];
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelect: (entry: FolderEntry, modifiers: SelectModifiers) => void;
  getChildren: (path: string) => FolderEntry[] | undefined;
  onContextMenu?: (entry: FolderEntry | null, x: number, y: number) => void;
  onDragStart?: (entry: FolderEntry) => void;
  onDragOver?: (entry: FolderEntry | null) => void;
  onDrop?: (targetEntry: FolderEntry | null) => void;
}

interface FileTreeItemProps {
  entry: FolderEntry;
  depth: number;
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelect: (entry: FolderEntry, modifiers: SelectModifiers) => void;
  getChildren: (path: string) => FolderEntry[] | undefined;
  onContextMenu?: (entry: FolderEntry | null, x: number, y: number) => void;
  onDragStart?: (entry: FolderEntry) => void;
  onDragOver?: (entry: FolderEntry | null) => void;
  onDrop?: (targetEntry: FolderEntry | null) => void;
  isDragOver?: boolean;
}

function FileTreeItem(props: FileTreeItemProps) {
  const isExpanded = () => props.expandedPaths.has(props.entry.path);
  const isSelected = () => props.selectedPaths.has(props.entry.path);
  const hasChildren = () => props.entry.entry_type !== "mix";
  const children = () => props.getChildren(props.entry.path);

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.entry.entry_type === "mix") {
      props.onSelect(props.entry, {
        shift: e.shiftKey,
        meta: e.metaKey || e.ctrlKey,
      });
    } else {
      // For folders, toggle expand
      props.onToggleExpand(props.entry.path);
    }
  };

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onToggleExpand(props.entry.path);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    props.onContextMenu?.(props.entry, e.clientX, e.clientY);
  };

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", props.entry.path);
    }
    props.onDragStart?.(props.entry);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    // Only collections can be drop targets
    if (props.entry.entry_type === "collection") {
      props.onDragOver?.(props.entry);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.entry.entry_type === "collection") {
      props.onDrop?.(props.entry);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    props.onDragOver?.(null);
  };

  return (
    <>
      <button
        class={`flex items-center gap-1 w-full text-left py-1.5 pr-2 hover:bg-neutral-800 rounded transition-colors ${
          isSelected() ? "bg-neutral-800 text-white" : "text-neutral-400"
        } ${props.isDragOver ? "ring-2 ring-blue-500 bg-blue-500/20" : ""}`}
        style={{ "padding-left": `${props.depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
        {/* Chevron for expandable items */}
        <Show when={hasChildren()} fallback={<span class="w-4 h-4 shrink-0" />}>
          <span
            class="w-4 h-4 flex items-center justify-center shrink-0 text-neutral-600 hover:text-neutral-400"
            onClick={handleChevronClick}
          >
            <svg
              class={`w-3 h-3 transition-transform ${isExpanded() ? "rotate-90" : ""}`}
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
          </span>
        </Show>

        {/* Icon */}
        <span class="w-4 h-4 flex items-center justify-center shrink-0">
          <Show when={props.entry.entry_type === "mix"}>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </Show>
          <Show when={props.entry.entry_type === "collection"}>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </Show>
        </span>

        {/* Name */}
        <span class="truncate text-sm">{props.entry.name}</span>
      </button>

      {/* Children */}
      <Show when={isExpanded() && children()}>
        <For each={sortEntries(children()!)}>
          {(child) => (
            <FileTreeItem
              entry={child}
              depth={props.depth + 1}
              expandedPaths={props.expandedPaths}
              selectedPaths={props.selectedPaths}
              onToggleExpand={props.onToggleExpand}
              onSelect={props.onSelect}
              getChildren={props.getChildren}
              onContextMenu={props.onContextMenu}
              onDragStart={props.onDragStart}
              onDragOver={props.onDragOver}
              onDrop={props.onDrop}
            />
          )}
        </For>
      </Show>
    </>
  );
}

export function FileTree(props: FileTreeProps) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredEntries = () => {
    const query = searchQuery().toLowerCase().trim();
    const sorted = sortEntries(props.entries);
    if (!query) return sorted;
    return sorted.filter((e) => e.name.toLowerCase().includes(query));
  };

  const handleTreeContextMenu = (e: MouseEvent) => {
    // Right-click on empty area
    e.preventDefault();
    props.onContextMenu?.(null, e.clientX, e.clientY);
  };

  const handleTreeDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    // Dropping on empty area = root
    props.onDragOver?.(null);
  };

  const handleTreeDrop = (e: DragEvent) => {
    e.preventDefault();
    // Drop on root
    props.onDrop?.(null);
  };

  return (
    <div class="flex flex-col h-full">
      {/* Search input */}
      <div class="px-2 py-2 border-b border-neutral-800">
        <div class="relative">
          <svg
            class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600"
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
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Filter..."
            class="w-full pl-8 pr-2 py-1.5 bg-neutral-900 rounded text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-700"
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Tree content */}
      <div
        class="flex-1 overflow-y-auto py-1"
        onContextMenu={handleTreeContextMenu}
        onDragOver={handleTreeDragOver}
        onDrop={handleTreeDrop}
      >
        <Show
          when={filteredEntries().length > 0}
          fallback={
            <div class="px-4 py-8 text-center text-neutral-600 text-sm">
              {searchQuery() ? "No matches" : "No items yet"}
            </div>
          }
        >
          <For each={filteredEntries()}>
            {(entry) => (
              <FileTreeItem
                entry={entry}
                depth={0}
                expandedPaths={props.expandedPaths}
                selectedPaths={props.selectedPaths}
                onToggleExpand={props.onToggleExpand}
                onSelect={props.onSelect}
                getChildren={props.getChildren}
                onContextMenu={props.onContextMenu}
                onDragStart={props.onDragStart}
                onDragOver={props.onDragOver}
                onDrop={props.onDrop}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
