/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      screens: {
        xs: '320px',
        '3xl': '1536px',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        poppins: ['Poppins', 'Inter', 'sans-serif'],
      },
      colors: {
        // --- Tutty Primary ---
        brand: {
          25: '#fff5fa',
          50: '#ffe8f4',
          100: '#ffd1e9',
          200: '#ffa3d3',
          300: '#ff75bc',
          400: '#ff57aa',
          500: '#FF3C97', // Tutty Pink
          600: '#e0207d',
          700: '#b80d63',
          800: '#8f0a4e',
          900: '#6b0e3d',
          950: '#3d0021',
        },
        // --- Tutty Secondary ---
        mango: {
          50: '#fffbeb',
          100: '#fff3c4',
          400: '#ffd54f',
          500: '#FFC107',
          600: '#e6ac00',
        },
        purple: {
          50: '#f5edf3',
          100: '#e8d5e3',
          500: '#6B2059',
          700: '#4a1540',
        },
        lavender: {
          50: '#f8f5fc',
          100: '#f0eaf8',
          400: '#D9C5E8',
          500: '#c5aedd',
        },
        // --- Tutty Extended ---
        tangerine: {
          50: '#fff4e6',
          500: '#FF8A00',
          600: '#e07a00',
        },
        coral: {
          50: '#fff2f2',
          500: '#FF6B6B',
          600: '#e05555',
        },
        mint: {
          50: '#edfff8',
          500: '#63E6BE',
          700: '#2db896',
        },
        ocean: {
          50: '#ebf4ff',
          500: '#3182CE',
          700: '#1a6aad',
        },
        // --- Tutty Neutral ---
        'gray-dark': '#140b11',
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
        },
        error: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          400: '#f97066',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
        },
        warning: {
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fedf89',
          400: '#fdb022',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
        },
        orange: {
          50: '#fff6ed',
          100: '#ffead5',
          400: '#fd853a',
          500: '#fb6514',
          600: '#ec4a0a',
        },
      },
      boxShadow: {
        'theme-xs': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
        'theme-sm': '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
        'theme-md':
          '0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)',
        'theme-lg':
          '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
        'theme-xl':
          '0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)',
      },
    },
  },
  plugins: [],
};
