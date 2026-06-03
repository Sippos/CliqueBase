import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['api/**/*.js', 'vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/components/MediaBlocks.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/pages/Share.jsx',
      'src/pages/CliqueSettings.jsx',
      'src/mobileExploreEnhancer.js',
      'src/components/TonightMode.jsx',
    ],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['src/components/PageNav.jsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
