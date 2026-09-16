/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F8F9FB',
        surface: '#FFFFFF',
        subtle: '#F1F3F5',
        muted: '#E9ECEF',
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          foreground: '#FFFFFF',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
        },
        danger: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
        },
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
          focus: '#2563EB',
        },
        text: {
          primary: '#111827',
          secondary: '#4B5563',
          tertiary: '#6B7280',
          disabled: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Noto Sans Bengali', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'h1': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h2': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'h3': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label': ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.05)',
        'sm': '0 1px 3px rgba(0,0,0,0.08)',
        'md': '0 4px 6px rgba(0,0,0,0.08)',
        'lg': '0 10px 15px rgba(0,0,0,0.1)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      minWidth: {
        '60': '15rem',
      },
    },
  },
  plugins: [],
};
