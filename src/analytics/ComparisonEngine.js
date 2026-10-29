// Comparison engine.
//
// Computes the percentage improvement (or degradation) of the adaptive
// controller versus the fixed-time baseline, using ACTUAL results from both
// runs (prompt section 10). For "lower is better" metrics:
//
//   improvementPercent = ((fixedValue - adaptiveValue) / fixedValue) * 100
//
// A positive number means adaptive is better. For "higher is better" metrics
// (throughput) the sign is flipped so positive still means "adaptive better".
// Zero denominators are handled gracefully.

// Metric definitions: key, label, and whether lower values are better.
export const COMPARISON_METRICS = [
  { key: 'avgWait', label: 'Average waiting time', unit: 's', lowerBetter: true },
  { key: 'avgQueue', label: 'Average queue length', unit: 'cars', lowerBetter: true },
  { key: 'peakQueue', label: 'Maximum queue length', unit: 'cars', lowerBetter: true },
  { key: 'throughput', label: 'Vehicle throughput', unit: '/hr', lowerBetter: false },
  { key: 'avgDelay', label: 'Average travel delay', unit: 's', lowerBetter: true },
  { key: 'avgEmergencyResponse', label: 'Emergency response delay', unit: 's', lowerBetter: true },
]

// Returns improvement percent where positive = adaptive better. Returns null
// when it cannot be computed (e.g. both zero, or fixed baseline is zero).
export function improvement(fixedValue, adaptiveValue, lowerBetter) {
  if (fixedValue == null || adaptiveValue == null) return null
  if (fixedValue === 0) {
    if (adaptiveValue === 0) return 0
    return null // undefined percentage against a zero baseline
  }
  const raw = ((fixedValue - adaptiveValue) / fixedValue) * 100
  return lowerBetter ? raw : -raw
}

// Build a comparison table from two metric summaries.
export function buildComparison(fixedMetrics, adaptiveMetrics) {
  return COMPARISON_METRICS.map((m) => {
    const fixedValue = fixedMetrics?.[m.key] ?? 0
    const adaptiveValue = adaptiveMetrics?.[m.key] ?? 0
    return {
      ...m,
      fixedValue,
      adaptiveValue,
      improvement: improvement(fixedValue, adaptiveValue, m.lowerBetter),
    }
  })
}
