import { useState } from 'react'
import { PlaceholderVisual } from '../ui/PlaceholderVisual'

export function ImpactSection({ impact }) {
  const [openPanels, setOpenPanels] = useState(() =>
    Object.fromEntries(impact.rows.map((row) => [row.title, 0])),
  )

  const handleToggle = (rowTitle, itemIndex) => {
    setOpenPanels((current) => ({
      ...current,
      [rowTitle]: current[rowTitle] === itemIndex ? -1 : itemIndex,
    }))
  }

  return (
    <section className="home-section home-impact" id="control">
      <div className="home-shell">
        <p className="home-kicker">{impact.kicker}</p>

        <div className="home-impact-stack">
          {impact.rows.map((row, index) => (
            <div
              key={row.title}
              className={`home-feature-row ${index % 2 === 1 ? 'is-reversed' : ''}`}
            >
              <div className="home-feature-copy">
                <h2>{row.title}</h2>
                <p>{row.body}</p>

                <div className="home-feature-list">
                  {row.items.map((item, itemIndex) => {
                    const isOpen = openPanels[row.title] === itemIndex

                    return (
                      <div
                        key={item.title}
                        className={`home-feature-list-item ${isOpen ? 'is-open' : ''}`}
                      >
                        <button
                          type="button"
                          className="home-feature-list-row"
                          onClick={() => handleToggle(row.title, itemIndex)}
                          aria-expanded={isOpen}
                        >
                          <span>{item.title}</span>
                          <span>{isOpen ? '−' : '+'}</span>
                        </button>

                        <div className="home-feature-list-panel" hidden={!isOpen}>
                          <p>{item.body}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="home-feature-visual">
                <PlaceholderVisual kind={row.visual} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
