import './Hero.css'

export function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="hero-kicker">Scalable AI architectures</p>
          <h1 className="hero-title">
            Let your data run your business, <em>without the busywork.</em>
          </h1>
          <p className="hero-description">
            StatsParrot turns cleaned data into business-ready views and
            decision outputs, so teams can focus on direction instead of
            repetitive pipeline maintenance.
          </p>
          <a className="hero-action" href="#gold-views">
            Explore views
          </a>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual-frame">Right-side component placeholder</div>
          <span className="hero-side-label">Placeholder</span>
        </div>
      </div>
    </section>
  )
}
