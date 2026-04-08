import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    const scrollRoot = document.getElementById('app-scroll-root')

    if (!scrollRoot) {
      return
    }

    if (!location.hash || location.hash === '#home') {
      scrollRoot.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }

    const targetId = location.hash.slice(1)
    let frameId = 0

    const scrollToTarget = () => {
      const target = document.getElementById(targetId)

      if (!target) {
        return
      }

      const targetTop = target.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top

      scrollRoot.scrollTo({
        top: scrollRoot.scrollTop + targetTop,
        left: 0,
        behavior: 'smooth',
      })
    }

    frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToTarget)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [location.hash, location.pathname])

  return null
}
