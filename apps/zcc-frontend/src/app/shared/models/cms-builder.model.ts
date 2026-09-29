export interface CmsSection {
  id: string;
  type: 'hero' | 'features' | 'cta' | 'header' | 'footer';
  title: string;
  content: Record<string, any>;
  orderIndex: number;
}

export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  sections: CmsSection[];
  createdAt: string;
}
