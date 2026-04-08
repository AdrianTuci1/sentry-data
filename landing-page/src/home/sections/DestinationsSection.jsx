export function DestinationsSection({ destinations }) {
  return (
    <section className="home-section home-destinations">
      <div className="home-shell home-destinations-grid">
        <div className="home-destinations-copy">
          <p className="home-kicker">{destinations.kicker}</p>
          <h2>{destinations.title}</h2>
          <p>{destinations.description}</p>

          <div className="home-point-list">
            {destinations.points.map((point) => (
              <div key={point} className="home-point-row">
                <span className="home-point-bullet" aria-hidden="true" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="home-destinations-visual" aria-hidden="true">
          <div className="home-destination-placeholder">
            <div className="home-destination-bar" />
            <div className="home-destination-flow">
              <span className="home-destination-node is-source">Signal</span>
              <span className="home-destination-line" />
              <span className="home-destination-node is-system">ParrotOS</span>
              <span className="home-destination-line" />
              <span className="home-destination-node is-output">Any destination</span>
            </div>
            <div className="home-destination-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
