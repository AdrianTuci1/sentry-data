import './HeroCollageLayout.css';
import { HeroMicroWidgets } from './HeroMicroWidgets';

/**
 * Standalone collage layout that wraps HeroMicroWidgets
 * inside the same positioning grid used in the original Hero section.
 *
 * Drop this inside any container with a defined size, e.g.:
 *   <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0b0b0b' }}>
 *     <HeroWidgetCollage />
 *   </div>
 */
export function HeroWidgetCollage() {
  return (
    <div className="hero-collage">
      <div className="hero-collage-frame">
        <div className="hero-collage-group">
          <HeroMicroWidgets />
        </div>
      </div>
    </div>
  );
}
