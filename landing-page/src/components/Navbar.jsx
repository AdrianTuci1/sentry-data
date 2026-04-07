import { Link } from 'react-router-dom'
import './Navbar.css'
import { navigation, useCaseDropdownItems } from '../content'
import parrotLogo from '../../assets/pyramid/parrot-white.png'

export function Navbar() {
  return (
    <header className="navbar-shell">
      <div className="navbar">
        <Link className="navbar-brand" to="/#home" aria-label="StatsParrot home">
          <img src={parrotLogo} alt="StatsParrot" style={{ width: '20px' }} />
        </Link>

        <nav className="navbar-nav" aria-label="Primary navigation">
          {navigation.map((item) =>
            item.label === 'Use Cases' ? (
              <div key={item.label} className="navbar-dropdown">
                <Link className="navbar-dropdown-trigger" to={item.href}>
                  <span>{item.label}</span>
                  <span className="navbar-dropdown-caret" aria-hidden="true" />
                </Link>

                <div className="navbar-dropdown-panel">
                  <div className="navbar-dropdown-grid">
                    {useCaseDropdownItems.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.label}
                        className="navbar-dropdown-link"
                        to={dropdownItem.href}
                      >
                        <span className="navbar-dropdown-link-title">{dropdownItem.label}</span>
                        <span className="navbar-dropdown-link-copy">
                          {dropdownItem.description}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={item.label} to={item.href}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <button className="navbar-menu" type="button" aria-label="Open menu">
          <span className="navbar-menu-lines" />
        </button>
      </div>
    </header>
  )
}
