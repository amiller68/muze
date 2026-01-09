import type { FolderEntry } from "../../types/navigation";
import type { Vault } from "../../types/vault";
import { FileTree, type SelectModifiers } from "./FileTree";
import { VaultSwitcher } from "./VaultSwitcher";

interface SidebarProps {
  entries: FolderEntry[];
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelect: (entry: FolderEntry, modifiers: SelectModifiers) => void;
  getChildren: (path: string) => FolderEntry[] | undefined;
  activeVault: Vault | null;
  onManageVaults: () => void;
  onDeleteSelected?: () => void;
  onContextMenu?: (entry: FolderEntry | null, x: number, y: number) => void;
  onDragStart?: (entry: FolderEntry) => void;
  onDragOver?: (entry: FolderEntry | null) => void;
  onDrop?: (targetEntry: FolderEntry | null) => void;
}

export function Sidebar(props: SidebarProps) {
  return (
    <div class="w-64 flex flex-col bg-neutral-950 border-r border-neutral-800 h-full">
      {/* File Tree (includes search and scrollable content) */}
      <div class="flex-1 min-h-0">
        <FileTree
          entries={props.entries}
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
      </div>

      {/* Vault Switcher at bottom */}
      <VaultSwitcher vault={props.activeVault} onManageVaults={props.onManageVaults} />
    </div>
  );
}
