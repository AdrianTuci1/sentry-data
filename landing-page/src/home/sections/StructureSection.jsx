export function StructureSection({ structure }) {
  return (
    <section className="home-section home-principles" id="system">
      <div className="home-shell">
        <div className="home-principles-header">
          <div className="home-section-heading">
            <p className="home-kicker">{structure.kicker}</p>
            <h2>{structure.title}</h2>
          </div>

          <div className="home-principles-intro">
            <p>{structure.intro}</p>
          </div>
        </div>

        <div className="home-principles-grid">
          {structure.cards.map((item) => (
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
  )
}
