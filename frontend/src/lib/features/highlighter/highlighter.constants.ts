import type { ThemeConfiguration } from './highlighter.types';

/**
 * UI constants for code highlighter
 */
export const UI_CONSTANTS = {
  COPY_TIMEOUT: 2000,
  ERROR_TIMEOUT: 3000,
  COPY_ICON: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 20"><path fill="currentColor" d="M8.5 2a1.5 1.5 0 0 0-1.415 1H5.5A1.5 1.5 0 0 0 4 4.5v12A1.5 1.5 0 0 0 5.5 18h2.503a2 2 0 0 1 .054-.347L8.221 17H5.5a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5h1.585A1.5 1.5 0 0 0 8.5 5h3a1.5 1.5 0 0 0 1.415-1H14.5a.5.5 0 0 1 .5.5v4.732c.32-.137.659-.213 1-.229V4.5A1.5 1.5 0 0 0 14.5 3h-1.585A1.5 1.5 0 0 0 11.5 2zM8 3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m1.98 11.877l4.83-4.83a1.87 1.87 0 1 1 2.644 2.646l-4.83 4.829a2.2 2.2 0 0 1-1.02.578l-1.498.374a.89.89 0 0 1-1.079-1.078l.375-1.498a2.2 2.2 0 0 1 .578-1.02"/></svg>`
};

export const vscodeThemes: ThemeConfiguration = {
  dark: {
    background: '#1e1e1e',
    text: '#d4d4d4',
    border: '#404040',
    button: 'rgba(255, 255, 255, 0.1)',
    buttonHover: 'rgba(255, 255, 255, 0.2)'
  },
  light: {
    background: '#ffffff',
    text: '#000000',
    border: '#d4d4d4',
    button: 'rgba(0, 0, 0, 0.1)',
    buttonHover: 'rgba(0, 0, 0, 0.2)'
  }
};

export const customThemes: ThemeConfiguration = {
  dark: {
    background: '#0d1117',
    text: '#c9d1d9',
    border: '#30363d',
    button: 'rgba(201, 209, 217, 0.1)',
    buttonHover: 'rgba(201, 209, 217, 0.2)'
  },
  light: {
    background: '#ffffff',
    text: '#24292f',
    border: '#d0d7de',
    button: 'rgba(36, 41, 47, 0.1)',
    buttonHover: 'rgba(36, 41, 47, 0.2)'
  }
};

// Simplified syntax colors following highlight.js theming guidelines
export const SyntaxColors = {
  // Core colors
  base: '#d4d4d4',
  keyword: '#c792ea',
  function: '#82aaff',
  string: '#89ddff',
  variable: '#eeffff',
  type: '#7fdbca',
  comment: '#546e7a',
  number: '#ff916e',
  decorator: '#82aaff',
  operator: '#89ddff'
};

// VS Code Dark+ theme colors
export const VSCodeSyntaxColors = {
  // Core colors
  base: '#d4d4d4',
  keyword: '#569cd6',      // blue
  module: '#c586c0',       // pink/purple for import/from/as
  function: '#dcdcaa',     // yellow
  string: '#ce9178',       // orange
  variable: '#9cdcfe',     // light blue
  type: '#4ec9b0',         // teal
  comment: '#6a9955',      // green
  number: '#b5cea8',       // light green
  decorator: '#dcdcaa',    // yellow
  operator: '#d4d4d4',     // default
  namespace: '#4ec9b0'     // teal for module names
};