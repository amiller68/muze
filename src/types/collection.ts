// Hierarchy: Collection > Mix

export interface Collection {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  children: Array<CollectionEntry | MixEntry>;
}

export interface CollectionEntry {
  type: "collection";
  id: string;
  name: string;
  path: string;
}

export interface MixEntry {
  type: "mix";
  id: string;
  name: string;
  path: string;
}
