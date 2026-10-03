// ============================================================================
// ZCC Analytics — Domain Models
// ============================================================================

export type AnalyticsRange = '7' | '30' | '90';

export interface AnalyticsTrendPoint {
  date: string;
  count: number;
}

export interface AnalyticsTopItem {
  name: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

export interface AnalyticsKpis {
  pageViews: number;
  uniqueVisitors: number;
  engagementRate: number;
  projectViews: number;
  blogViews: number;
}

export interface AnalyticsTrends {
  pageViews: AnalyticsTrendPoint[];
  uniqueVisitors: AnalyticsTrendPoint[];
  engagement: AnalyticsTrendPoint[];
}

export interface AnalyticsOverview {
  generatedAt: string;
  kpis: AnalyticsKpis;
  trends: AnalyticsTrends;
  topPages: AnalyticsTopItem[];
  topReferrers: AnalyticsTopItem[];
  topCountries: AnalyticsTopItem[];
  topCities: AnalyticsTopItem[];
  deviceBreakdown: AnalyticsDeviceBreakdown;
  topBrowsers: AnalyticsTopItem[];
  topOS: AnalyticsTopItem[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedList<T> {
  data: T[];
  meta: PaginationMeta;
}
