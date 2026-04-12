import { ApprovalFlowVisual, ImpactLoopVisual } from './ProductVisuals'

export function PlaceholderVisual({ kind }) {
  if (kind === 'impact') {
    return <ImpactLoopVisual />
  }

  return <ApprovalFlowVisual />
}
