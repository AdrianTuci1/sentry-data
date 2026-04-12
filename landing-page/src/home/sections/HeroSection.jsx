import { Link } from 'react-router-dom'
import { HeroCardScene } from '../ui/HeroCardScene'

export function HeroSection({ hero }) {
  return (
    <section className="home-hero" id="home">
      <div className="home-shell home-hero-intro">
        <div className="home-hero-copy">
          <p className="home-kicker">{hero.kicker}</p>
          <h1>{hero.title}</h1>
        </div>

        <div className="home-hero-side">
          <p className="home-hero-lead">{hero.lead}</p>
          <p className="home-hero-description">{hero.description}</p>

          <div className="home-actions">
            <Link className="home-action home-action-primary" to="/request-access">
              {hero.primaryActionLabel}
            </Link>
            <Link className="home-action home-action-secondary" to="/pricing">
              {hero.secondaryActionLabel}
            </Link>
          </div>
        </div>
      </div>

      <div className="home-shell">
        <HeroCardScene />
      </div>
    </section>
  )
}
