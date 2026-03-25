/**
 * IQR-based outlier detection for workflow phase timing analysis.
 * Detects phases exceeding Q3 + 1.5*IQR threshold.
 *
 * @spec docs/workflows/harness-analytics-improvement/planning.md
 */

export interface OutlierResult {
  phase: string;
  seconds: number;
  isOutlier: boolean;
  iqrScore: number; // (value - Q3) / IQR; values > 1.5 are outliers
}

/**
 * Detects timing outliers using the Interquartile Range (IQR) method.
 *
 * Rules:
 * - Returns empty array if fewer than 4 data points
 * - Returns empty array if IQR is zero (all values identical)
 * - Otherwise, returns phases exceeding Q3 + 1.5*IQR
 *
 * @param timings Record mapping phase names to timing objects with seconds
 * @returns Array of OutlierResult objects for outliers only
 */
export function detectOutliers(
  timings: Record<string, { seconds: number }>
): OutlierResult[] {
  // Extract values and phases
  const entries = Object.entries(timings);
  const values = entries.map(([, obj]) => obj.seconds).sort((a, b) => a - b);

  // Insufficient data
  if (values.length < 4) {
    return [];
  }

  // Calculate Q1 and Q3
  const q1 = calculateQuartile(values, 0.25);
  const q3 = calculateQuartile(values, 0.75);
  const iqr = q3 - q1;

  // No variance in data
  if (iqr === 0) {
    return [];
  }

  // Identify outliers
  const upperBound = q3 + 1.5 * iqr;
  const outliers: OutlierResult[] = [];

  for (const [phase, obj] of entries) {
    const seconds = obj.seconds;
    if (seconds > upperBound) {
      const iqrScore = (seconds - q3) / iqr;
      outliers.push({
        phase,
        seconds,
        isOutlier: true,
        iqrScore,
      });
    }
  }

  return outliers;
}

/**
 * Calculates the median of the lower half (Q1) or upper half (Q3).
 * Uses the inclusive method (includes median in both halves).
 */
function calculateQuartile(
  sortedValues: number[],
  percentile: 0.25 | 0.75
): number {
  const len = sortedValues.length;
  const midpoint = Math.floor(len / 2);

  if (percentile === 0.25) {
    // Lower half
    const lowerHalf = sortedValues.slice(0, midpoint);
    return lowerHalf.length > 0
      ? lowerHalf[Math.floor((lowerHalf.length - 1) / 2)]
      : sortedValues[0];
  } else {
    // Upper half
    const upperHalf =
      len % 2 === 0
        ? sortedValues.slice(midpoint)
        : sortedValues.slice(midpoint + 1);
    return upperHalf.length > 0
      ? upperHalf[Math.floor((upperHalf.length - 1) / 2)]
      : sortedValues[len - 1];
  }
}
