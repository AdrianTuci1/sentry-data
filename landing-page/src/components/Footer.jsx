import './Footer.css'
import { navigation } from '../content'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-brand-block">
          <a className="footer-brand" href="#home" aria-label="StatsParrot home">
            SP
          </a>
          <p className="footer-copy">
            A clean data layer for operators who need reporting, orchestration, and action in one
            place.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          {navigation.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
