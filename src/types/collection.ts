// Hierarchy: Collection > Project > Mix

export interface Collection {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  children: Array<CollectionEntry | ProjectEntry>;
}

export interface CollectionEntry {
  type: "collection";
  id: string;
  name: string;
  path: string;
}

export interface ProjectEntry {
  type: "project";
  id: string;
  name: string;
  path: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  mixes: MixEntry[];
}

export interface MixEntry {
  id: string;
  name: string;
  path: string;
}
