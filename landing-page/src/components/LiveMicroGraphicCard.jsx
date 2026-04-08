import './LiveMicroGraphicCard.css'
import {
  ArcSummaryMicro,
  RingSummaryMicro,
} from '../../../sentry-frontend/src/components/visuals/micrographics/DashboardMicros'
import {
  GaugePanelMicro,
  MetricTrendMicro,
  SignalScaleMicro,
  SparklineStatMicro,
} from './LiveDashboardMicros'

const componentRegistryById = {
  'ai-coverage': GaugePanelMicro,
  'budget-burn': SparklineStatMicro,
  'data-saturation': RingSummaryMicro,
  'marketing-conv-rate': ArcSummaryMicro,
  'marketing-cpa': SparklineStatMicro,
  'marketing-roas': MetricTrendMicro,
  'viral-k-factor': MetricTrendMicro,
}

const componentRegistryByType = {
  'gauge-panel': GaugePanelMicro,
  'light-dial': SignalScaleMicro,
  'liquid-gauge': SignalScaleMicro,
  natural: SparklineStatMicro,
  weather: MetricTrendMicro,
}

function prepareWidgetData(widget) {
  const data = widget?.data || {}
  const merged = {
    ...widget,
    ...data,
    data,
  }

  if (merged.sliderValue === undefined && Number.isFinite(merged.signalScore)) {
    merged.sliderValue = merged.signalScore
  }

  if (!merged.gaugeUnit && merged.unit) {
    merged.gaugeUnit = merged.unit
  }

  if (!merged.trendTone) {
    merged.trendTone = merged.trendDirection === 'down' ? 'negative' : 'positive'
  }

  return merged
}

export function LiveMicroGraphicCard({ widget }) {
  const data = prepareWidgetData(widget)
  const Graphic =
    componentRegistryById[data.id] || componentRegistryByType[data.type] || MetricTrendMicro

  return (
    <article className={`micro-card ${data.colorTheme || 'theme-productivity'}`}>
      <div className="micro-card-header">
        {data.title && <h3 className="micro-title">{data.title}</h3>}
        {data.subtitle && <span className="micro-subtitle">{data.subtitle}</span>}
      </div>

      <div className="micro-card-body">
        <Graphic data={data} />
      </div>

      <div className="micro-card-footer">
        {data.footerText && <span className="footer-main">{data.footerText}</span>}
      </div>
    </article>
  )
}
