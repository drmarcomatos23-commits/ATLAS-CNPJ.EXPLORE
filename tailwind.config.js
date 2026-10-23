const tokens = require('./design/tailwind.tokens.js');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  ...tokens,
};
