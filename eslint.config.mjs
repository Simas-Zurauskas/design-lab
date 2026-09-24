// `yarn lint` — bugs, not style (Prettier owns style). ESLint's recommended set: undefined names, unused variables,
// unreachable code, and empty blocks — which makes every catch-and-continue say why in a comment.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.parcel-cache/', 'node_modules/'] },
  js.configs.recommended,
  {
    // the lab: classic browser scripts sharing window.Lab (core/lab.js defines it; theme.js / view-math.js add to it)
    files: ['src/_lab/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Lab: 'readonly' } },
  },
  {
    files: ['src/_lab/core/lab.js'], // where the Lab global is declared
    languageOptions: { globals: { Lab: 'off' } },
  },
  {
    files: ['src/_lab/icons/icons.js'], // the one ES module in the lab
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];
