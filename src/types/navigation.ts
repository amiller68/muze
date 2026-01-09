export type NavLocation =
  | { type: "collections"; path: string }
  | { type: "project"; path: string }
  | { type: "mix"; path: string };

export interface FolderEntry {
  name: string;
  path: string;
  entry_type: "collection" | "project" | "mix" | "unknown";
  modified_at?: string | null;
}
