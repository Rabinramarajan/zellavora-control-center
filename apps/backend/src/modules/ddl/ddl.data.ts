/**
 * DDL Seed Data
 * Shared key/value dropdown lists for forms (country, language, gender, etc.)
 */

export interface DdlSeedItem {
  type: string;
  key: string;
  value: string;
  label?: string | null;
  phoneCode?: string | null;
  sortOrder?: number;
}

export const DDL_SEED: DdlSeedItem[] = [
  // ============================= GENDERS =============================
  { type: 'gender', key: 'male', value: 'Male', sortOrder: 1 },
  { type: 'gender', key: 'female', value: 'Female', sortOrder: 2 },
  { type: 'gender', key: 'other', value: 'Other', sortOrder: 3 },
  { type: 'gender', key: 'prefer_not_to_say', value: 'Prefer not to say', sortOrder: 4 },

  // ============================= LANGUAGES =============================
  { type: 'language', key: 'en', value: 'English', label: 'English', sortOrder: 1 },
  { type: 'language', key: 'hi', value: 'Hindi', label: 'हिन्दी', sortOrder: 2 },
  { type: 'language', key: 'es', value: 'Spanish', label: 'Español', sortOrder: 3 },
  { type: 'language', key: 'fr', value: 'French', label: 'Français', sortOrder: 4 },
  { type: 'language', key: 'de', value: 'German', label: 'Deutsch', sortOrder: 5 },
  { type: 'language', key: 'pt', value: 'Portuguese', label: 'Português', sortOrder: 6 },
  { type: 'language', key: 'zh', value: 'Chinese', label: '中文', sortOrder: 7 },
  { type: 'language', key: 'ja', value: 'Japanese', label: '日本語', sortOrder: 8 },
  { type: 'language', key: 'ko', value: 'Korean', label: '한국어', sortOrder: 9 },
  { type: 'language', key: 'ar', value: 'Arabic', label: 'العربية', sortOrder: 10 },

  // ============================= COUNTRIES =============================
  { type: 'country', key: 'IN', value: 'India', phoneCode: '+91', sortOrder: 1 },
  { type: 'country', key: 'US', value: 'United States', phoneCode: '+1', sortOrder: 2 },
  { type: 'country', key: 'GB', value: 'United Kingdom', phoneCode: '+44', sortOrder: 3 },
  { type: 'country', key: 'CA', value: 'Canada', phoneCode: '+1', sortOrder: 4 },
  { type: 'country', key: 'AU', value: 'Australia', phoneCode: '+61', sortOrder: 5 },
  { type: 'country', key: 'DE', value: 'Germany', phoneCode: '+49', sortOrder: 6 },
  { type: 'country', key: 'FR', value: 'France', phoneCode: '+33', sortOrder: 7 },
  { type: 'country', key: 'JP', value: 'Japan', phoneCode: '+81', sortOrder: 8 },
  { type: 'country', key: 'SG', value: 'Singapore', phoneCode: '+65', sortOrder: 9 },
  { type: 'country', key: 'AE', value: 'United Arab Emirates', phoneCode: '+971', sortOrder: 10 },
  { type: 'country', key: 'AF', value: 'Afghanistan', phoneCode: '+93', sortOrder: 11 },
  { type: 'country', key: 'AL', value: 'Albania', phoneCode: '+355', sortOrder: 12 },
  { type: 'country', key: 'DZ', value: 'Algeria', phoneCode: '+213', sortOrder: 13 },
  { type: 'country', key: 'AR', value: 'Argentina', phoneCode: '+54', sortOrder: 14 },
  { type: 'country', key: 'AT', value: 'Austria', phoneCode: '+43', sortOrder: 15 },
  { type: 'country', key: 'BD', value: 'Bangladesh', phoneCode: '+880', sortOrder: 16 },
  { type: 'country', key: 'BE', value: 'Belgium', phoneCode: '+32', sortOrder: 17 },
  { type: 'country', key: 'BR', value: 'Brazil', phoneCode: '+55', sortOrder: 18 },
  { type: 'country', key: 'CN', value: 'China', phoneCode: '+86', sortOrder: 19 },
  { type: 'country', key: 'CO', value: 'Colombia', phoneCode: '+57', sortOrder: 20 },
  { type: 'country', key: 'HR', value: 'Croatia', phoneCode: '+385', sortOrder: 21 },
  { type: 'country', key: 'CZ', value: 'Czech Republic', phoneCode: '+420', sortOrder: 22 },
  { type: 'country', key: 'DK', value: 'Denmark', phoneCode: '+45', sortOrder: 23 },
  { type: 'country', key: 'EG', value: 'Egypt', phoneCode: '+20', sortOrder: 24 },
  { type: 'country', key: 'FI', value: 'Finland', phoneCode: '+358', sortOrder: 25 },
  { type: 'country', key: 'GR', value: 'Greece', phoneCode: '+30', sortOrder: 26 },
  { type: 'country', key: 'HK', value: 'Hong Kong', phoneCode: '+852', sortOrder: 27 },
  { type: 'country', key: 'HU', value: 'Hungary', phoneCode: '+36', sortOrder: 28 },
  { type: 'country', key: 'ID', value: 'Indonesia', phoneCode: '+62', sortOrder: 29 },
  { type: 'country', key: 'IE', value: 'Ireland', phoneCode: '+353', sortOrder: 30 },
  { type: 'country', key: 'IL', value: 'Israel', phoneCode: '+972', sortOrder: 31 },
  { type: 'country', key: 'IT', value: 'Italy', phoneCode: '+39', sortOrder: 32 },
  { type: 'country', key: 'KE', value: 'Kenya', phoneCode: '+254', sortOrder: 33 },
  { type: 'country', key: 'KR', value: 'South Korea', phoneCode: '+82', sortOrder: 34 },
  { type: 'country', key: 'MY', value: 'Malaysia', phoneCode: '+60', sortOrder: 35 },
  { type: 'country', key: 'MX', value: 'Mexico', phoneCode: '+52', sortOrder: 36 },
  { type: 'country', key: 'NL', value: 'Netherlands', phoneCode: '+31', sortOrder: 37 },
  { type: 'country', key: 'NZ', value: 'New Zealand', phoneCode: '+64', sortOrder: 38 },
  { type: 'country', key: 'NG', value: 'Nigeria', phoneCode: '+234', sortOrder: 39 },
  { type: 'country', key: 'NO', value: 'Norway', phoneCode: '+47', sortOrder: 40 },
  { type: 'country', key: 'PK', value: 'Pakistan', phoneCode: '+92', sortOrder: 41 },
  { type: 'country', key: 'PH', value: 'Philippines', phoneCode: '+63', sortOrder: 42 },
  { type: 'country', key: 'PL', value: 'Poland', phoneCode: '+48', sortOrder: 43 },
  { type: 'country', key: 'PT', value: 'Portugal', phoneCode: '+351', sortOrder: 44 },
  { type: 'country', key: 'RO', value: 'Romania', phoneCode: '+40', sortOrder: 45 },
  { type: 'country', key: 'RU', value: 'Russia', phoneCode: '+7', sortOrder: 46 },
  { type: 'country', key: 'SA', value: 'Saudi Arabia', phoneCode: '+966', sortOrder: 47 },
  { type: 'country', key: 'ZA', value: 'South Africa', phoneCode: '+27', sortOrder: 48 },
  { type: 'country', key: 'ES', value: 'Spain', phoneCode: '+34', sortOrder: 49 },
  { type: 'country', key: 'SE', value: 'Sweden', phoneCode: '+46', sortOrder: 50 },
  { type: 'country', key: 'CH', value: 'Switzerland', phoneCode: '+41', sortOrder: 51 },
  { type: 'country', key: 'TW', value: 'Taiwan', phoneCode: '+886', sortOrder: 52 },
  { type: 'country', key: 'TH', value: 'Thailand', phoneCode: '+66', sortOrder: 53 },
  { type: 'country', key: 'TR', value: 'Turkey', phoneCode: '+90', sortOrder: 54 },
  { type: 'country', key: 'UA', value: 'Ukraine', phoneCode: '+380', sortOrder: 55 },
  { type: 'country', key: 'VN', value: 'Vietnam', phoneCode: '+84', sortOrder: 56 },
];
