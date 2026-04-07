import './LiveMicroGraphicCard.css'
import RealMapbox from '../../../sentry-frontend/src/components/visuals/micrographics/RealMapbox'
import CreativeQuadrant from '../../../sentry-frontend/src/components/visuals/micrographics/CreativeQuadrant'
import LeadsList from '../../../sentry-frontend/src/components/visuals/micrographics/LeadsList'
import { LiveMicroGraphicCard } from './LiveMicroGraphicCard'

const specialWidgetRegistry = {
  'creative-quadrant': CreativeQuadrant,
  'romania-3d': RealMapbox,
  'stat-leads': LeadsList,
}

export function LiveDomainWidgetCard({ widget }) {
  const SpecialGraphic = specialWidgetRegistry[widget.id]

  if (!SpecialGraphic) {
    return <LiveMicroGraphicCard widget={widget} />
  }

  return (
    <article className={`feature-card ${widget.colorTheme || 'theme-productivity'}`}>
      <div className="feature-card-header">
        {widget.title && <h3 className="feature-title">{widget.title}</h3>}
        {widget.subtitle && <span className="feature-subtitle">{widget.subtitle}</span>}
      </div>

      <div className="feature-card-body">
        <SpecialGraphic data={widget.data || {}} />
      </div>

      <div className="feature-card-footer">
        {widget.footerText && <span className="footer-main">{widget.footerText}</span>}
      </div>
    </article>
  )
}
