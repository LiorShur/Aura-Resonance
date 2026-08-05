/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Dark theme from the concept art: deep navy base, luminous cyan/violet
      // accents, glassmorphic panels. See docs/assets reference mockups.
      colors: {
        base: {
          DEFAULT: '#0b1026',
          900: '#070b1c',
          800: '#0b1026',
          700: '#141b3a',
          600: '#1e2850',
        },
        aura: {
          cyan: '#4fd6ff',
          violet: '#a06bff',
          magenta: '#ff6bd6',
          gold: '#ffca61',
          green: '#5bf0c0',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
};
