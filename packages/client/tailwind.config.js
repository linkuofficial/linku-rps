/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#f9f9f9',
          dim: '#dadada',
          bright: '#f9f9f9',
          container: {
            lowest: '#ffffff',
            low: '#f3f3f4',
            DEFAULT: '#eeeeee',
            high: '#e8e8e8',
            highest: '#e2e2e2',
          },
        },
        'on-surface': {
          DEFAULT: '#1a1c1c',
          variant: '#4c4546',
        },
        outline: {
          DEFAULT: '#7e7576',
          variant: '#cfc4c5',
        },
        primary: {
          DEFAULT: '#000000',
          container: '#1b1b1b',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#848484',
        },
        secondary: {
          DEFAULT: '#5d5e66',
          container: '#e3e1ec',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#63646c',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': {
          DEFAULT: '#ffffff',
          container: '#93000a',
        },
        border: '#E4E4E7',
        'surface-alt': '#F4F4F5',
      },
    },
  },
  plugins: [],
};