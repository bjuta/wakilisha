import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest configuration for the WAKILISHA chart scoring engine test suite.
 *
 * Tests live in test/ at the repo root — never in src/.
 * The scoring module coverage requirement is 100% line + branch (brief §8).
 *
 * Scoring module files under coverage:
 *   src/services/chartsScoring/scoringEngine.ts
 *   src/services/chartsScoring/normalize.ts
 *   src/services/chartsScoring/airplayEngine.ts
 *   src/services/chartsScoring/eligibilityEngine.ts
 *   src/services/chartsScoring/scoringPipeline.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/chartsScoring/scoringEngine.ts',
        'src/services/chartsScoring/normalize.ts',
        'src/services/chartsScoring/airplayEngine.ts',
        'src/services/chartsScoring/eligibilityEngine.ts',
        'src/services/chartsScoring/scoringPipeline.ts',
      ],
      exclude: [
        'src/services/chartsScoring/normalize.smoke.ts',
        'src/services/chartsScoring/scoringTypes.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});