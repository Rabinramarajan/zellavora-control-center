// Mirrors apps/backend/src/modules/blog.

export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[];
  coverImageUrl: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  viewCount: number;
  readingMinutes: number;
  seoTitle: string | null;
  seoDescription: string | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogStats {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  archived: number;
  totalViews: number;
  createdThisMonth: number;
  trend: { created: number[]; published: number[]; drafts: number[]; views: number[] };
}

export interface BlogCategory {
  name: string;
  count: number;
}

export interface SavePostRequest {
  title: string;
  slug?: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[];
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  version?: number;
}
