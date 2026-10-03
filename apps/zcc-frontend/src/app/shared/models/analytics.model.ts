// ============================================================================
// ZCC Analytics — Domain Models (mirror apps/backend/src/modules/analytics)
// ============================================================================

export type AnalyticsRange = '7' | '30' | '90';

export interface AnalyticsMetric {
  value: number;
  previous: number;
  /** Percent change from the previous period; null when there is nothing to compare with. */
  change: number | null;
}

export interface AnalyticsDailyPoint {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  engagementRate: number;
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

export interface AnalyticsOverview {
  generatedAt: string;
  range: { days: number; from: string; to: string };
  kpis: {
    pageViews: AnalyticsMetric;
    uniqueVisitors: AnalyticsMetric;
    sessions: AnalyticsMetric;
    engagementRate: AnalyticsMetric;
    avgSessionSeconds: AnalyticsMetric;
  };
  daily: AnalyticsDailyPoint[];
  topPages: AnalyticsTopItem[];
  topReferrers: AnalyticsTopItem[];
  topCountries: AnalyticsTopItem[];
  topCities: AnalyticsTopItem[];
  topBrowsers: AnalyticsTopItem[];
  topOS: AnalyticsTopItem[];
  deviceBreakdown: AnalyticsDeviceBreakdown;
}

export interface TrackEventRequest {
  sessionId: string;
  visitorId: string;
  eventType: 'pageview' | 'event';
  eventName?: string;
  path: string;
  title?: string;
  referrer?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}
