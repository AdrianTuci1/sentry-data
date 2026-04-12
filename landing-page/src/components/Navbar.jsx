import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'
import { navigation, useCaseDropdownItems } from '../content'
import logo from '../../assets/logo.png'

export function Navbar() {
  const location = useLocation()

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }

  return (
    <header className="navbar-shell">
      <div className="navbar">
        <Link className="navbar-brand" to="/" aria-label="Home" onClick={handleHomeClick}>
          <img src={logo} alt="" />
        </Link>

        <nav className="navbar-nav" aria-label="Primary navigation">
          <Link to="/" onClick={handleHomeClick}>
            Home
          </Link>

          <div className="navbar-dropdown">
            <span className="navbar-dropdown-trigger">
              <span>Articles</span>
              <span className="navbar-dropdown-caret" aria-hidden="true" />
            </span>

            <div className="navbar-dropdown-panel">
              <div className="navbar-dropdown-grid">
                {useCaseDropdownItems.map((item) => (
                  <Link key={item.label} className="navbar-dropdown-link" to={item.href}>
                    <span className="navbar-dropdown-link-title">{item.label}</span>
                    <span className="navbar-dropdown-link-copy">{item.description}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {navigation
            .filter((item) => item.label !== 'Home')
            .map((item) => (
              <Link key={item.label} to={item.href}>
                {item.label}
              </Link>
            ))}
        </nav>

        <Link className="navbar-cta" to="/request-access">
          Request access
        </Link>
      </div>
    </header>
  )
}
