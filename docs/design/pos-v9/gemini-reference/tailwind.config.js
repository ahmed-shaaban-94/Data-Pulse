// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        // Surface Colors
        bg: '#050e17',
        card: '#081826',
        elevated: '#163452',
        panel: '#0c1f30',
        // Ink/Text Colors
        ink: { DEFAULT: '#e8ecf2', 2: '#b8c0cc', 3: '#7a8494', 4: '#3f4a5a' },
        // Accent Colors
        accent: { DEFAULT: '#00c7f2', hi: '#5cdfff' },
        ok: '#1dd48b',
        warn: '#ffab3d',
        bad: '#ff7b7b',
        purple: '#7467f8',
        blue: '#20bce5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'Inter', 'sans-serif'],
        display: ['Fraunces', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(0,199,242,0.35)',
        card: '0 0 0 1px rgba(0,199,242,0.12), 0 0 28px rgba(0,199,242,0.1)',
      }
    }
  }
}