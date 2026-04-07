import marketingData from '../../../sentry-frontend/src/data/analyticsData-marketing.json'
import saasData from '../../../sentry-frontend/src/data/analyticsData-saas.json'
import cyberData from '../../../sentry-frontend/src/data/analyticsData-cybersecurity-xdr.json'
import { liveInsightsBridgeContent } from '../content/homePageContent'

const WIDGET_IDS = [
  'marketing-roas',
  'marketing-cpa',
  'marketing-conv-rate',
  'data-saturation',
  'ai-coverage',
  'budget-burn',
]

export const W1 = [
  [1.25, -0.12, 0.72, 0.05, 0.18, 0.85],
  [0.18, 1.15, 0.72, 0.44, 0.24, 0.28],
  [0.96, 0.24, 1.12, 0.16, 0.74, 0.52],
  [0.42, 0.88, 0.34, 1.06, 0.66, 0.72],
  [0.24, 0.52, 0.18, 0.56, 1.18, 0.84],
]

const B1 = [-0.82, -0.78, -0.92, -0.88, -0.84, -0.86]

export const W2 = [
  [1.06, 0.42, 0.76, 0.28, 0.88],
  [0.38, 1.08, 0.52, 0.84, 0.36],
  [0.92, 0.36, 1.12, 0.44, 0.72],
  [0.44, 0.96, 0.34, 1.06, 0.52],
  [0.28, 0.56, 0.98, 0.62, 1.04],
  [0.74, 0.42, 0.68, 0.88, 0.96],
]

const B2 = [-0.88, -0.84, -0.92, -0.86, -0.88]

export const OUTPUT_DESTINATIONS = liveInsightsBridgeContent.output.destinations

export const DEFAULT_OUTPUT_ANCHOR = { x: 0.9, y: 0.5, winner: 0 }

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const mix = (from, to, progress) => from + (to - from) * progress

const sigmoid = (value) => 1 / (1 + Math.exp(-value))

const dense = (input, weights, bias) =>
  weights[0].map((_, outputIndex) =>
    sigmoid(
      input.reduce(
        (sum, current, inputIndex) => sum + current * weights[inputIndex][outputIndex],
        bias[outputIndex],
      ),
    ),
  )

const proximityScore = (left, right) =>
  1 -
  Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length)

const pickWidgets = (dataset) =>
  WIDGET_IDS.map((id) => dataset.find((widget) => widget.id === id)).filter(Boolean)

const findWidget = (dataset, matcher) => dataset.find(matcher) || null

const mergeWidget = (widget, overrides = {}) => {
  if (!widget) {
    return null
  }

  const nextData = {
    ...(widget.data || {}),
    ...(overrides.data || {}),
  }

  return {
    ...widget,
    ...overrides,
    data: nextData,
  }
}

const DOMAIN_SIGNALS = [
  [0.92, 0.48, 0.81, 0.66, 0.74],
  [0.58, 0.91, 0.72, 0.84, 0.69],
  [0.87, 0.78, 0.94, 0.57, 0.62],
]

const ecommerceWidgets = pickWidgets(marketingData)

const saasWidgets = [
  mergeWidget(findWidget(saasData, (widget) => widget.title === 'Open Tickets'), {
    gridSpan: 'row-span-2',
  }),
  ...pickWidgets(saasData).slice(0, 4),
].filter(Boolean)

const cyberWidgets = [
  mergeWidget(findWidget(cyberData, (widget) => widget.id === 'romania-3d'), {
    gridSpan: 'col-span-2 row-span-2',
    data: {
      mapProjection: 'globe',
      mapAutoRotate: true,
      mapFitBounds: false,
      mapZoom: 1.42,
      mapPitch: 0,
      mapBearing: 0,
      mapCenter: [12, 20],
      mapRotationSpeed: 2.4,
    },
  }),
  mergeWidget(findWidget(cyberData, (widget) => widget.id === 'creative-quadrant'), {
    gridSpan: 'row-span-2',
  }),
].filter(Boolean)

const DOMAIN_WIDGETS = [ecommerceWidgets, saasWidgets, cyberWidgets]

export const DOMAINS = liveInsightsBridgeContent.domains.map((domain, index) => ({
  label: domain.label,
  eyebrow: domain.eyebrow,
  signal: DOMAIN_SIGNALS[index],
  widgets: DOMAIN_WIDGETS[index],
}))

const OUTPUT_PROTOTYPES = DOMAINS.map((domain) => dense(dense(domain.signal, W1, B1), W2, B2))

export const W3 = Array.from({ length: OUTPUT_PROTOTYPES[0].length }, (_, hiddenIndex) =>
  OUTPUT_PROTOTYPES.map((prototype) => prototype[hiddenIndex]),
)

export function interpolateArray(from, to, progress) {
  return from.map((value, index) => value + (to[index] - value) * progress)
}

export function easing(progress) {
  if (progress < 0.5) {
    return 2 * progress * progress
  }

  return 1 - Math.pow(-2 * progress + 2, 2) / 2
}

export function rangeProgress(progress, start, end) {
  if (end <= start) {
    return progress >= end ? 1 : 0
  }

  return easing(clamp((progress - start) / (end - start), 0, 1))
}

function normalizeActivity(values, floor = 0.16) {
  const min = Math.min(...values)
  const max = Math.max(...values)

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return values.map(() => floor)
  }

  if (max - min < 0.0001) {
    return values.map(() => 0.72)
  }

  return values.map((value) => floor + ((value - min) / (max - min)) * (1 - floor))
}

function propagateRelevance(nextLayerFocus, weights, nodeValues) {
  return weights.map((row, nodeIndex) => {
    const weightedActivation = row.reduce(
      (sum, weight, targetIndex) => sum + Math.abs(weight) * nextLayerFocus[targetIndex],
      0,
    )

    return weightedActivation * (0.3 + nodeValues[nodeIndex] * 0.7)
  })
}

export function computeLayerFocus(current, winner) {
  const outputSeed = current.outputs.map((value, index) =>
    index === winner ? value * 1.2 : value * 0.45,
  )
  const outputs = normalizeActivity(outputSeed, 0.14).map((value, index) =>
    index === winner ? Math.min(1, value + 0.18) : value * 0.58,
  )
  const hidden2 = normalizeActivity(
    propagateRelevance(outputs, W3, current.hidden2),
    0.18,
  )
  const hidden1 = normalizeActivity(
    propagateRelevance(hidden2, W2, current.hidden1),
    0.16,
  )
  const input = normalizeActivity(
    propagateRelevance(hidden1, W1, current.input),
    0.14,
  )

  return { input, hidden1, hidden2, outputs }
}

export function computeNetworkStep(targetIndex) {
  const target = DOMAINS[targetIndex]
  const input = target.signal.map((value, index) =>
    clamp(value + Math.sin((targetIndex + 1) * (index + 2) * 1.37) * 0.045, 0.12, 0.98),
  )
  const hidden1 = dense(input, W1, B1)
  const hidden2 = dense(hidden1, W2, B2)
  const outputs = OUTPUT_PROTOTYPES.map((prototype) => proximityScore(hidden2, prototype))
  const winner = outputs.indexOf(Math.max(...outputs))

  return { input, hidden1, hidden2, outputs, winner }
}
