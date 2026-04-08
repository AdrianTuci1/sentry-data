import './App.css'
import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { ScrollManager } from './components/ScrollManager'
import { HomePage } from './home/HomePage'
import { PricingPage } from './pages/PricingPage'
import { SupportPage } from './pages/SupportPage'
import { UseCaseArticlePage } from './pages/UseCaseArticlePage'

function App() {
  return (
    <div className="app-shell">
      <ScrollManager />
      <Navbar />
      <div className="app-scroll" id="app-scroll-root">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/use-cases/:slug" element={<UseCaseArticlePage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default App
