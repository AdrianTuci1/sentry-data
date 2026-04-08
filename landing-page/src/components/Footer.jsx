import { Link, useLocation } from 'react-router-dom'
import './Footer.css'
import { navigation } from '../content'

export function Footer() {
  const location = useLocation()

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-panel">
          <div className="footer-hero">
            <div className="footer-hero-copy">
              <h2>Guide the system with clarity.</h2>
              <p>
                A software layer for teams that want to see the system clearly and route outputs
                wherever work happens.
              </p>
            </div>
          </div>

          <div className="footer-image-placeholder" aria-hidden="true" />

          <div className="footer-main-row">
            <Link className="footer-brand" to="/" aria-label="ParrotOS home" onClick={handleHomeClick}>
              ParrotOS
            </Link>

            <nav className="footer-nav" aria-label="Footer navigation">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={item.href === '/' ? handleHomeClick : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="footer-socials" aria-label="Social links">
              <span>X</span>
              <span>in</span>
            </div>
          </div>

          <div className="footer-meta-row">
            <span>Copyright 2026 ParrotOS</span>
            <div className="footer-meta-links">
              <span>Status</span>
              <span>Terms of Use</span>
              <span>Privacy Policy</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
