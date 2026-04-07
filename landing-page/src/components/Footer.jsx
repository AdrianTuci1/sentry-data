import { Link } from 'react-router-dom'
import './Footer.css'
import { navigation } from '../content'
import parrotLogo from '../../assets/pyramid/parrot-white.png'

export function Footer() {
  return (
    <footer className="footer" id="support">
      <div className="footer-shell">
        <div className="footer-brand-block">
          <Link className="footer-brand" to="/#home" aria-label="StatsParrot home">
            <img src={parrotLogo} alt="StatsParrot" style={{ width: '20px' }} /> ParrotOS
          </Link>
          <p className="footer-copy">
            A clean data layer for operators who need reporting, orchestration, and action in one
            place.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          {navigation.map((item) => (
            <Link key={item.label} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
