// applyTheme.js — copies theme.js into CSS variables on <html>, so CSS files can write
// var(--color-primary) or var(--space-md). Nested keys join with dashes:
//   colors.status.FAILED → --color-status-FAILED,  font.size.md → --font-size-md (15px)
// Owner: Huzaifah.
import { theme } from './theme.js';

const prefixes = { colors: 'color', font: 'font', space: 'space', radius: 'radius' };

function setVars(object, name, style) {
  for (const [key, value] of Object.entries(object)) {
    const varName = `${name}-${key}`;
    if (typeof value === 'object') setVars(value, varName, style);
    else style.setProperty(varName, typeof value === 'number' ? `${value}px` : value);
  }
}

export function applyTheme() {
  const style = document.documentElement.style;
  for (const [group, prefix] of Object.entries(prefixes)) {
    setVars(theme[group], `--${prefix}`, style);
  }
  // Font weights are plain numbers, not pixels.
  style.setProperty('--font-weight-regular', theme.font.weight.regular);
  style.setProperty('--font-weight-bold', theme.font.weight.bold);
}
