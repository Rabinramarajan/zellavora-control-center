/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      borderRadius: {
        // Scales with the theme's corner radius; defaults equal Tailwind's 0.5rem / 0.75rem / 1rem.
        lg: 'calc(var(--app-radius, 10px) * 0.8)',
        xl: 'calc(var(--app-radius, 10px) * 1.2)',
        '2xl': 'calc(var(--app-radius, 10px) * 1.6)',
      },
      colors: {
        // Indigo is the app's brand colour; it reads the active organization theme (see brand-palette.ts).
        indigo: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [
            s,
            `rgb(var(--brand-${s}) / <alpha-value>)`,
          ])
        ),
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c3d66',
        },
        secondary: {
          50: '#f9f5ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        accent: {
          50: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        dark: {
          50: '#f9fafb',
          900: '#111827',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#374151',
            a: {
              color: '#0ea5e9',
              '&:hover': {
                color: '#0284c7',
              },
            },
          },
        },
      },
      spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
        '2xl': '3rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
  safelist: [
    'bg-red-50',
    'bg-green-50',
    'bg-blue-50',
    'text-red-700',
    'text-green-700',
    'text-blue-700',
  ],
};
