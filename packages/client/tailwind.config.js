/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          dim: 'rgb(var(--color-surface-dim) / <alpha-value>)',
          bright: 'rgb(var(--color-surface-bright) / <alpha-value>)',
          container: {
            lowest: 'rgb(var(--color-surface-container-lowest) / <alpha-value>)',
            low: 'rgb(var(--color-surface-container-low) / <alpha-value>)',
            DEFAULT: 'rgb(var(--color-surface-container) / <alpha-value>)',
            high: 'rgb(var(--color-surface-container-high) / <alpha-value>)',
            highest: 'rgb(var(--color-surface-container-highest) / <alpha-value>)',
          },
        },
        'on-surface': {
          DEFAULT: 'rgb(var(--color-on-surface) / <alpha-value>)',
          variant: 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        },
        outline: {
          DEFAULT: 'rgb(var(--color-outline) / <alpha-value>)',
          variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          container: 'rgb(var(--color-primary-container) / <alpha-value>)',
        },
        'on-primary': {
          DEFAULT: 'rgb(var(--color-on-primary) / <alpha-value>)',
          container: 'rgb(var(--color-on-primary-container) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          container: 'rgb(var(--color-secondary-container) / <alpha-value>)',
        },
        'on-secondary': {
          DEFAULT: 'rgb(var(--color-on-secondary) / <alpha-value>)',
          container: 'rgb(var(--color-on-secondary-container) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--color-error) / <alpha-value>)',
          container: 'rgb(var(--color-error-container) / <alpha-value>)',
        },
        'on-error': {
          DEFAULT: 'rgb(var(--color-on-error) / <alpha-value>)',
          container: 'rgb(var(--color-on-error-container) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'surface-alt': 'rgb(var(--color-surface-alt) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};