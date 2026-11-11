// theme.js — the single source of colours, fonts and spacing.
// The mobile app copies this file unchanged, so web and app look the same.
// main.jsx turns these values into CSS variables (--color-primary, --space-md, …);
// components never hard-code a colour or a size. Owner: Huzaifah.
export const theme = {
  colors: {
    primary: '#2F5DE1',
    primaryText: '#FFFFFF',
    primaryHover: '#2448B8', // darker blue for pressed/hover buttons
    primarySoft: '#EAF0FD', // pale blue behind selected items
    background: '#F7F8FA',
    surface: '#FFFFFF',
    border: '#E3E6EB',
    borderStrong: '#C9CFD8', // inputs and inactive step circles
    text: '#1B1F24',
    textMuted: '#5F6B7A',
    success: '#1E9E5A',
    warning: '#C98A00',
    danger: '#D2393C',
    info: '#2F5DE1',
    // Text on the pale "soft" backgrounds below: darker shades so small text stays readable (WCAG AA).
    successText: '#13703F',
    warningText: '#7A5300',
    dangerText: '#A82A2D',
    successSoft: '#E7F5EE',
    warningSoft: '#FBF3E0',
    dangerSoft: '#FCEBEB',
    ladderBaseline: '#8A94A6', // the F16 bar in the compression ladder
    status: {
      QUEUED: '#8A94A6',
      RUNNING: '#2F5DE1',
      COMPLETED: '#1E9E5A',
      FAILED: '#D2393C',
      CANCELLED: '#8A94A6',
    },
  },
  font: {
    family: "'Inter Variable', Inter, system-ui, sans-serif",
    size: { sm: 13, md: 15, lg: 18, xl: 24 },
    weight: { regular: 400, bold: 600 },
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 6, md: 10, lg: 16 },
};
