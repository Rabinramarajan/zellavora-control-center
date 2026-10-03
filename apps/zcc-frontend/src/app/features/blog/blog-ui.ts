import { BlogStatus } from '../../shared/models/blog.model';

export const STATUS_LABEL: Record<BlogStatus, string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ARCHIVED: 'Archived',
};

export const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const PERIOD_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

/** Suggested categories for new posts; any category already in use is offered too. */
export const SUGGESTED_CATEGORIES = [
  'Web Development',
  'Tutorial',
  'AI / Machine Learning',
  'Backend',
  'Performance',
  'Design',
  'Company News',
];

const CATEGORY_TONES = ['violet', 'sky', 'rose', 'emerald', 'amber', 'fuchsia', 'cyan'] as const;
export type CategoryTone = (typeof CATEGORY_TONES)[number];

/** Stable colour per category name, so a category always looks the same. */
export const categoryTone = (name: string): CategoryTone => {
  let hash = 0;
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
};

export const initials = (name: string | null | undefined): string =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
