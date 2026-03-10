/**
 * N-83: Visual regression CI integration helpers.
 * Provides animation freeze CSS injection and Playwright screenshot utilities.
 */

/** CSS to freeze all animations/transitions for deterministic screenshots */
export const FREEZE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition: none !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
`.trim();

/** Inject freeze-animations CSS into a Playwright page */
export async function freezeAnimations(page: any): Promise<void> {
  await page.addStyleTag({ content: FREEZE_ANIMATIONS_CSS });
  await page.waitForTimeout(100);
}

/** Capture screenshot with frozen animations for visual comparison */
export async function captureStableScreenshot(
  page: any,
  name: string,
  options?: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } },
): Promise<Buffer> {
  await freezeAnimations(page);
  return page.screenshot({
    path: `tests/e2e/__snapshots__/${name}.png`,
    fullPage: options?.fullPage ?? true,
    ...(options?.clip ? { clip: options.clip } : {}),
  });
}

/** CI configuration for visual regression providers */
export const CI_VISUAL_REGRESSION = {
  /** GitHub Actions step for Argos CI */
  argosGitHubAction: {
    name: 'Upload to Argos',
    uses: 'argos-ci/argos-action@v2',
    with: { token: '${{ secrets.ARGOS_TOKEN }}', directory: 'tests/e2e/__snapshots__' },
  },
  /** GitHub Actions step for Chromatic */
  chromaticGitHubAction: {
    name: 'Publish to Chromatic',
    uses: 'chromaui/action@latest',
    with: { projectToken: '${{ secrets.CHROMATIC_PROJECT_TOKEN }}', exitZeroOnChanges: true },
  },
} as const;

/** Viewport presets for responsive visual testing */
export const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  widescreen: { width: 1920, height: 1080 },
} as const;
