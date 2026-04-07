import './App.css'
import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { ScrollManager } from './components/ScrollManager'
import { HomePage } from './pages/HomePage'
import { PricingPage } from './pages/PricingPage'
import { UseCaseArticlePage } from './pages/UseCaseArticlePage'

function App() {
  return (
    <div className="app-shell">
      <ScrollManager />
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/use-cases/:slug" element={<UseCaseArticlePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
