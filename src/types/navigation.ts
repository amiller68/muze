export type NavLocation = { type: "collections"; path: string } | { type: "mix"; path: string };

export interface FolderEntry {
  name: string;
  path: string;
  entry_type: "collection" | "mix" | "unknown";
  modified_at?: string | null;
}
