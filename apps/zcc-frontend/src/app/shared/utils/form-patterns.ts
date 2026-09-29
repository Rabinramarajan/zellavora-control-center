/** Regexes shared by forms whose rules are looser than the `@zellavoras/ui` presets. */
export const FORM_PATTERNS = {
  /** Allows the spaces, dashes and parentheses people type in phone numbers. */
  phone: /^\+?[0-9\s\-()]{7,20}$/,
  url: /^https?:\/\/\S+\.\S+$/,
} as const;
