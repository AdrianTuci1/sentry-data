import { Hero } from '../components/Hero'
import { PipelineFlow } from '../components/PipelineFlow'
import { LiveInsightsBridge } from '../components/LiveInsightsBridge'
import { ArchitectureLayers } from '../components/ArchitectureLayers'

export function HomePage() {
  return (
    <>
      <Hero />
      <PipelineFlow />
      <LiveInsightsBridge />
      <ArchitectureLayers />
    </>
  )
}
