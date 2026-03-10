/**
 * N-42: Visual regression config scaffold.
 * Requires Chromatic/Percy/Argos CI to execute.
 */

export const VISUAL_REGRESSION_CONFIG = {
  /** Visual regression provider */
  provider: 'argos-ci' as const, // or 'chromatic', 'percy'

  /** Inject animation:none!important to freeze CSS animations */
  freezeAnimations: true,

  /** Pixel diff tolerance (1% = 0.01) */
  diffThreshold: 0.01,

  /** Viewport configurations for responsive testing */
  viewports: [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 812, name: 'mobile' },
  ],

  /** Directory for snapshot storage */
  snapshotDir: 'tests/e2e/__snapshots__',

  /** File extensions to include in visual testing */
  includeExtensions: ['.tsx', '.jsx'],

  /** Argos CI specific settings */
  argos: {
    token: process.env['ARGOS_TOKEN'] ?? '',
    branch: process.env['CI_BRANCH'] ?? 'main',
    parallel: true,
    parallelNonce: process.env['CI_BUILD_ID'] ?? '',
  },

  /** Chromatic specific settings */
  chromatic: {
    projectToken: process.env['CHROMATIC_PROJECT_TOKEN'] ?? '',
    exitZeroOnChanges: false,
    autoAcceptChanges: 'main',
  },
} as const;
