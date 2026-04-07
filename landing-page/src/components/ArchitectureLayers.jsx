import { Link } from 'react-router-dom'
import './ArchitectureLayers.css'
import { ArchitectureLayersCanvas } from './ArchitectureLayersCanvas'
import { architectureContent } from '../content/homePageContent'

export function ArchitectureLayers() {
  return (
    <section className="architecture-section" id="architecture">
      <div className="architecture-stage">
        <div className="architecture-copy">
          <h2>{architectureContent.title}</h2>
          <p className="architecture-intro">{architectureContent.intro}</p>

          <div className="architecture-steps">
            {architectureContent.steps.map((step) => (
              <p key={step}>{step}</p>
            ))}
          </div>

          <div className="architecture-actions">
            <Link className="architecture-action architecture-action-primary" to="/pricing">
              {architectureContent.primaryActionLabel}
            </Link>
            <Link className="architecture-action architecture-action-secondary" to="/pricing">
              {architectureContent.secondaryActionLabel}
            </Link>
          </div>
        </div>
        <div className="architecture-visual">
          <ArchitectureLayersCanvas />
        </div>
      </div>
    </section>
  )
}
