export interface Prompt {
  id: string;
  title: string;
  prompt_text: string;
  image_url?: string;
  image_token?: string;
  cover_url?: string;
  ratio: string;
  category_id: string;
  subcategory: string;
  wiki_node_token: string;
  wiki_obj_token: string;
  wiki_doc_title: string;
  source_url?: string;
  tags?: string;
  sync_status?: string;
  view_count?: number;
  favorite?: boolean;
  gallery_images?: GalleryImage[];
  created_at: number;
  updated_at: number;
  category_name?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  prompt_count: number;
}

export interface GalleryImage {
  id: string;
  filename: string;
  url: string;
  original_name: string;
  size: number;
  uploaded_at: number;
  synced: boolean;
  feishu_block_id: string | null;
  feishu_token: string | null;
}

export interface Subcategory {
  subcategory: string;
  count: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PromptsResponse {
  prompts: Prompt[];
  pagination: Pagination;
}

export interface SyncLogEntry {
  id: number;
  sync_type: string;
  status: string;
  items_synced: number;
  errors: string | null;
  started_at: number;
  completed_at: number | null;
}

export interface Stats {
  total: number;
  categories: number;
  lastSync: SyncLogEntry | null;
  recentActivity: Prompt[];
}

export const CAT_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  illustration: { bg: '#f5ede4', accent: '#c4956a', label: '#8b5e3c' },
  poster:       { bg: '#f0e8f5', accent: '#9b6fc4', label: '#6b3fa0' },
  arch:         { bg: '#e8f0f5', accent: '#5a9bbf', label: '#2d6a8a' },
  meme:         { bg: '#f5f0e8', accent: '#c4a06a', label: '#8b6a2c' },
  hanzi:        { bg: '#f5ede8', accent: '#c4785a', label: '#8b3c1c' },
  playful:      { bg: '#f5f8e8', accent: '#8bc45a', label: '#4a7a1c' },
  travel:       { bg: '#e8f5f0', accent: '#5ac4a0', label: '#2a7a5a' },
  edu:          { bg: '#e8f5f5', accent: '#5ac4c4', label: '#2a7a7a' },
  tech:         { bg: '#e8f0f8', accent: '#7a5ac4', label: '#4a2a8b' },
  logo:         { bg: '#f0f5e8', accent: '#8ba05a', label: '#5a702a' },
  effect:       { bg: '#f5e8e8', accent: '#c45a7a', label: '#8b2a4a' },
  kawaii:       { bg: '#f8e8f5', accent: '#c47abf', label: '#8b4a7a' },
  abstract:     { bg: '#f0e8f0', accent: '#9b5ac4', label: '#6b2a8b' },
  landing:      { bg: '#e8f0f0', accent: '#5a8bc4', label: '#2a5a8b' },
  other:        { bg: '#f0f0f0', accent: '#8a8a8a', label: '#4a4a4a' },
};
