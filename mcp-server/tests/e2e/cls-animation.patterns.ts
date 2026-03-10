/**
 * N-41: CLS/Animation verification patterns (scaffold).
 * Requires Playwright + browser environment to execute.
 */

/** Good CLS score threshold per web.dev Core Web Vitals */
export const CLS_THRESHOLD = 0.1;

/** Needs Improvement CLS threshold */
export const CLS_NEEDS_IMPROVEMENT = 0.25;

/**
 * Wait for all CSS animations on an element subtree to complete.
 * @param page - Playwright Page object
 * @param selector - CSS selector for the target element
 */
export async function waitForAnimationsComplete(
  page: any,
  selector: string,
): Promise<void> {
  await page.locator(selector).evaluate((el: Element) => {
    return Promise.all(
      el.getAnimations({ subtree: true }).map((a: Animation) => a.finished),
    );
  });
}

/**
 * Measure Cumulative Layout Shift (CLS) during an action.
 * Uses PerformanceObserver to collect layout-shift entries.
 * @param page - Playwright Page object
 * @param action - Async function that triggers potential layout shifts
 * @returns CLS score (lower is better, <0.1 is "Good")
 */
export async function measureCLS(
  page: any,
  action: () => Promise<void>,
): Promise<number> {
  await page.evaluate(() => {
    (window as any).__clsScore = 0;
    new PerformanceObserver((list: PerformanceObserverEntryList) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          (window as any).__clsScore += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await action();

  return page.evaluate(() => (window as any).__clsScore);
}

/**
 * Assert CLS is within acceptable threshold after an action.
 * @param page - Playwright Page object
 * @param action - Async function that triggers potential layout shifts
 * @param threshold - Maximum acceptable CLS (default: 0.1)
 */
export async function assertCLSWithinThreshold(
  page: any,
  action: () => Promise<void>,
  threshold: number = CLS_THRESHOLD,
): Promise<{ score: number; passed: boolean }> {
  const score = await measureCLS(page, action);
  return { score, passed: score <= threshold };
}
