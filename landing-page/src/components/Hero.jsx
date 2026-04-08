import { Link } from 'react-router-dom'
import './Hero.css'
import { HeroMicroWidgets } from './HeroMicroWidgets'
import { heroContent } from '../content/homePageContent'

export function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="hero-kicker">{heroContent.kicker}</p>
          <h1 className="hero-title">
            {heroContent.titlePrefix} <em>{heroContent.titleEmphasis}</em>
          </h1>
          <p className="hero-description">{heroContent.description}</p>
          <div className="hero-actions">
            <Link className="hero-action" to="/pricing">
              {heroContent.primaryActionLabel}
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual-fade" />
          <div className="hero-collage">
            <div className="hero-collage-frame">
              <div className="hero-collage-group">
                <HeroMicroWidgets />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
