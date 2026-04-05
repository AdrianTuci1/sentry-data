import './Hero.css'
import sessionsWide from '../../assets/charts/sessions-wide.png'
import funnelWide from '../../assets/charts/funnel-wide.png'
import activityTall from '../../assets/charts/activity-tall.png'
import infraSquared from '../../assets/charts/infra-squared.png'
import creativeSquared from '../../assets/charts/creative-squared.png'

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
          <div className="hero-visual-fade" />
          <div className="hero-collage">
            <figure className="hero-card hero-card-sessions">
              <img src={sessionsWide} alt="" loading="eager" />
            </figure>
            <figure className="hero-card hero-card-funnel">
              <img src={funnelWide} alt="" loading="eager" />
            </figure>
            <figure className="hero-card hero-card-activity">
              <img src={activityTall} alt="" loading="eager" />
            </figure>
            <figure className="hero-card hero-card-infra">
              <img src={infraSquared} alt="" loading="eager" />
            </figure>
            <figure className="hero-card hero-card-creative">
              <img src={creativeSquared} alt="" loading="eager" />
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}
