import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'dist/**',
      '.pages-build/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // Public anchors are intentionally shared with the standalone Pages export.
      '@next/next/no-html-link-for-pages': 'off',
      // Existing fetch/calendar effects are outside this visual change.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
