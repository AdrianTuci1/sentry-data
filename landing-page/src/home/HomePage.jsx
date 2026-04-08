import { useEffect } from 'react'
import './home.css'
import { homeContent } from './content'
import { HeroSection } from './sections/HeroSection'
import { StructureSection } from './sections/StructureSection'
import { ImpactSection } from './sections/ImpactSection'
import { DestinationsSection } from './sections/DestinationsSection'

export function HomePage() {
  useEffect(() => {
    const scrollRoot = document.getElementById('app-scroll-root')

    if (!scrollRoot) {
      return
    }

    scrollRoot.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  return (
    <div className="home-page">
      <HeroSection hero={homeContent.hero} />
      <StructureSection structure={homeContent.structure} />
      <ImpactSection impact={homeContent.impact} />
      <DestinationsSection destinations={homeContent.destinations} />
    </div>
  )
}
