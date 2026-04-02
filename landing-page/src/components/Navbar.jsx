import './Navbar.css'
import { navigation } from '../content'

export function Navbar() {
  return (
    <header className="navbar-shell">
      <div className="navbar">
        <a className="navbar-brand" href="#home" aria-label="StatsParrot home">
          SP
        </a>

        <nav className="navbar-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <button className="navbar-menu" type="button" aria-label="Open menu">
          <span className="navbar-menu-lines" />
        </button>
      </div>
    </header>
  )
}
