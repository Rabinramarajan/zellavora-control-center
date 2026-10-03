export type CmsPageStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type CmsPageType = 'STANDARD' | 'LANDING' | 'ARTICLE' | 'SYSTEM' | 'CUSTOM';
export type CmsComponentType =
  // Layout
  | 'container' | 'section' | 'columns' | 'grid' | 'stack' | 'divider' | 'spacer'
  // Content
  | 'heading' | 'paragraph' | 'rich-text' | 'image' | 'video' | 'icon' | 'button' | 'link'
  // Marketing
  | 'hero' | 'cta' | 'feature-grid' | 'stats' | 'logo-cloud' | 'testimonials' | 'faq' | 'pricing' | 'banner'
  // Navigation
  | 'header' | 'navbar' | 'breadcrumb' | 'tabs' | 'footer'
  // Data
  | 'table' | 'card' | 'list' | 'badge'
  // Forms
  | 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file-upload' | 'form' | 'submit-button'
  // Legacy
  | 'features';

export type CmsDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile';

export interface CmsResponsiveStyles {
  desktop?: Record<string, unknown>;
  laptop?: Record<string, unknown>;
  tablet?: Record<string, unknown>;
  mobile?: Record<string, unknown>;
}

export interface CmsSection {
  id: string;
  type: CmsComponentType;
  title: string;
  content: Record<string, unknown>;
  orderIndex: number;
  props?: Record<string, unknown>;
  styles?: CmsResponsiveStyles;
  children?: CmsSection[];
  hidden?: boolean;
  locked?: boolean;
}

export interface CmsSeoMeta {
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  status: CmsPageStatus;
  type: CmsPageType;
  template?: string;
  parentId?: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  seo?: CmsSeoMeta;
  sections: CmsSection[];
  schemaVersion: number;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  version?: number;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface CmsPageSummary {
  id: string;
  title: string;
  slug: string;
  status: CmsPageStatus;
  type: CmsPageType;
  updatedAt: string;
  createdAt: string;
}

export interface CmsPageStats {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  archived: number;
}

export interface CmsPageFilters {
  q: string;
  status: string;
  type: string;
}

export interface CmsPageListParams extends CmsPageFilters {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

export interface CmsPageVersion {
  id: string;
  pageId: string;
  version: number;
  status: CmsPageStatus;
  savedAt: string;
  savedBy?: string;
  label?: string;
}

export interface CmsCreatePageRequest {
  title: string;
  type: CmsPageType;
  template?: string;
  parentId?: string | null;
  slug?: string;
}

export interface PaginatedCmsPages {
  items: CmsPageSummary[];
  total: number;
  page: number;
  pageSize: number;
}
