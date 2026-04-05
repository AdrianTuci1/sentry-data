import './ArchitectureLayers.css'
import { ArchitectureLayersCanvas } from './ArchitectureLayersCanvas'

export function ArchitectureLayers() {
  return (
    <section className="architecture-section" id="architecture">
      <div className="architecture-stage">
        <div className="architecture-copy">
          <h2>We've got you covered</h2>
          <p className="architecture-intro">
            Our application is intuitive out of the box, but you can still customize it
            to match your own preferences.
          </p>

          <div className="architecture-steps">
            <p>Connect a source and preserve the underlying context.</p>
            <p>Describe what you want to see and which signals matter most.</p>
            <p>We build artifacts on the data and route them to external applications.</p>
          </div>
        </div>
        <div className="architecture-visual">
          <ArchitectureLayersCanvas />
        </div>
      </div>
    </section>
  )
}
