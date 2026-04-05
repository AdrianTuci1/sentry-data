import './CallToAction.css'

export function CallToAction() {
  return (
    <section className="cta-section" id="pricing">
      <div className="cta-shell">
        <p className="cta-kicker">Pricing that scales with the work</p>
        <h2>Free to start and affordable as you grow.</h2>
        <p className="cta-copy">
          Launch with a lightweight setup, validate the workflow fast, and only pay more when your
          data volume and automation needs grow.
        </p>

        <div className="cta-actions">
          <a className="cta-action cta-action-primary" href="#home">
            Start Free
          </a>
          <a className="cta-action cta-action-secondary" href="#gold-views">
            See Platform Flow
          </a>
        </div>
      </div>
    </section>
  )
}
