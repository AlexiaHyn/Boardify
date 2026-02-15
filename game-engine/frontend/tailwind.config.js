/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'bounce-once': 'bounceOnce 0.5s ease-out forwards',
      },
      keyframes: {
        bounceOnce: {
          '0%': { transform: 'translateX(-50%) translateY(-20px)', opacity: '0' },
          '60%': { transform: 'translateX(-50%) translateY(5px)', opacity: '1' },
          '100%': { transform: 'translateX(-50%) translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
