import './App.css'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { UseCasesShowcase } from './components/UseCasesShowcase'
import { PipelineFlow } from './components/PipelineFlow'
import { ArchitectureLayers } from './components/ArchitectureLayers'
import { CallToAction } from './components/CallToAction'
import { Footer } from './components/Footer'

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Hero />
        <PipelineFlow />
        <ArchitectureLayers />
        <UseCasesShowcase />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}

export default App
