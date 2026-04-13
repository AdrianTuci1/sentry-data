import { StructureCardVisual } from '../ui/ProductVisuals'
import avatar1 from '../../assets/avatars/avatar-1.png'
import avatar2 from '../../assets/avatars/avatar-2.png'
import avatar3 from '../../assets/avatars/avatar-3.png'
import avatar4 from '../../assets/avatars/avatar-4.png'

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
                  <StructureCardVisual kind={item.placeholder} />

                  {item.placeholder === 'green' ? (
                    <div className="home-placeholder-avatars">
                      <div className="home-placeholder-avatars-tag">Live guidance</div>
                      <div className="home-placeholder-avatar-row">
                        <img src={avatar1} alt="" className='avatar' />
                        <img src={avatar2} alt="" className='avatar' />
                        <img src={avatar3} alt="" className='avatar' />
                        <img src={avatar4} alt="" className='avatar' />
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
