/** Design tokens consumed by twrnc (apps/mobile/src/lib/tw.ts).
 *  Mirrors design/tokens/colors.css + apps/web @theme so web + mobile match.
 *  twrnc reads `theme.extend` and merges it with the default Tailwind scale. */
module.exports = {
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: '#F4720E', soft: '#FFEEDB', strong: '#D85F06', ink: '#8A4309' },
        mint: { DEFAULT: '#16B97D', soft: '#D7F6E9', strong: '#0E9E68', ink: '#0A6A46' },
        indigo: { DEFAULT: '#5B63E6', soft: '#E7E8FD', strong: '#444CCB', ink: '#2C3196' },
        coin: { DEFAULT: '#FFC93C', soft: '#FFF3CC', strong: '#F0B315', ink: '#8A6400' },
        ink: {
          900: '#211E27',
          800: '#2F2B38',
          700: '#443F4E',
          500: '#756E80',
          400: '#A39CAD',
          300: '#CAC4D0',
          200: '#E6E2EA',
          100: '#F0EDF2',
          50: '#F7F5F9',
        },
        surface: { page: '#F8F5F1', card: '#FFFFFF' },
        danger: { DEFAULT: '#E5484D', soft: '#FCE3E3', ink: '#B11216' },
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '22px',
        xl: '28px',
        '2xl': '36px',
        card: '24px',
        pill: '9999px',
      },
      fontFamily: {
        display: ['Baloo 2'],
        sans: ['Nunito'],
        number: ['Baloo 2'],
      },
    },
  },
};
