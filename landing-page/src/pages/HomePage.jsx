import { Link } from 'react-router-dom'
import { HeroMicroWidgets } from '../components/HeroMicroWidgets'
import { minimalHomePageContent } from '../content/homePageContent'
import './HomePage.css'

export function HomePage() {
  const { hero, principles, system, control, closing } = minimalHomePageContent

  return (
    <div className="home-page">
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
              <Link className="home-action home-action-primary" to="/pricing">
                {hero.primaryActionLabel}
              </Link>
              <Link className="home-action home-action-secondary" to="/pricing">
                {hero.secondaryActionLabel}
              </Link>
            </div>
          </div>
        </div>

        <div className="home-shell">
          <div className="home-stage">
            <div className="home-card-scene" aria-hidden="true">
              <HeroMicroWidgets />
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-principles" id="system">
        <div className="home-shell">
          <div className="home-principles-header">
            <div className="home-section-heading">
              <p className="home-kicker">{principles.kicker}</p>
              <h2>{principles.title}</h2>
            </div>

            <div className="home-principles-intro">
              <p>{principles.intro}</p>
            </div>
          </div>

          <div className="home-principles-grid">
            {principles.cards.map((item) => (
              <article key={item.title} className="home-principle-card">
                <div className={`home-principle-media is-${item.placeholder}`}>
                  <div className={`home-principle-placeholder is-${item.placeholder}`}>
                    {item.placeholder === 'warm' ? (
                      <div className="home-placeholder-card">
                        <span className="home-placeholder-label">System Journeys</span>
                        <strong>365</strong>
                        <span className="home-placeholder-meta">142 progressing as planned</span>
                        <div className="home-placeholder-rule" />
                        <div className="home-placeholder-stats">
                          <span>120 intake</span>
                          <span>200 in-system</span>
                          <span>45 outputs</span>
                        </div>
                      </div>
                    ) : null}

                    {item.placeholder === 'cool' ? (
                      <div className="home-placeholder-chart">
                        <div className="home-placeholder-chart-top">
                          <span>System Cycles</span>
                          <span>1-7 Apr</span>
                        </div>
                        <div className="home-placeholder-chart-bars">
                          <span />
                          <span className="is-active" />
                          <span />
                          <span />
                        </div>
                        <div className="home-placeholder-chart-labels">
                          <span>Tue</span>
                          <span>Wed</span>
                          <span>Thu</span>
                          <span>Fri</span>
                        </div>
                        <div className="home-placeholder-chart-footer">34.4% on track</div>
                      </div>
                    ) : null}

                    {item.placeholder === 'green' ? (
                      <div className="home-placeholder-avatars">
                        <div className="home-placeholder-avatars-tag">Live guidance</div>
                        <div className="home-placeholder-avatar-row">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-system-view">
        <div className="home-shell home-two-column">
          <div className="home-section-heading">
            <p className="home-kicker">{system.kicker}</p>
            <h2>{system.title}</h2>
          </div>

          <div className="home-body-column">
            {system.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            <div className="home-point-list">
              {system.points.map((point) => (
                <div key={point} className="home-point-row">
                  <span className="home-point-bullet" aria-hidden="true" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-control" id="control">
        <div className="home-shell home-control-panel">
          <p className="home-kicker">{control.kicker}</p>
          <div className="home-control-grid">
            <h2>{control.title}</h2>
            <p>{control.body}</p>
          </div>
        </div>
      </section>

      <section className="home-section home-closing">
        <div className="home-shell home-closing-panel">
          <p className="home-kicker">{closing.kicker}</p>
          <h2>{closing.title}</h2>
          <p>{closing.description}</p>

          <div className="home-actions">
            <Link className="home-action home-action-primary" to="/pricing">
              {closing.primaryActionLabel}
            </Link>
            <Link className="home-action home-action-secondary" to="/pricing">
              {closing.secondaryActionLabel}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
