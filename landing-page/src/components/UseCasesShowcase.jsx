import './UseCasesShowcase.css'
import { useCaseCards } from '../content'

function DatabaseGraphic() {
  return (
    <svg viewBox="0 0 160 160" role="presentation" aria-hidden="true">
      <rect
        x="22"
        y="22"
        width="116"
        height="116"
        rx="22"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
      />
      <ellipse
        cx="80"
        cy="60"
        rx="31"
        ry="11"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
      />
      <path
        d="M49 60v41c0 6.6 13.9 12 31 12s31-5.4 31-12V60"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
      />
      <path
        d="M49 80c0 6.6 13.9 12 31 12s31-5.4 31-12"
        fill="none"
        stroke="#ff7f57"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PaymentGraphic() {
  return (
    <svg viewBox="0 0 180 120" role="presentation" aria-hidden="true">
      <circle cx="20" cy="60" r="2.8" fill="#ff7f57" />
      <path d="M20 60C75 60 75 20 130 20h34" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 60C78 60 78 36 136 36h28" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 60H164" fill="none" stroke="#ff7f57" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 60C78 60 78 84 136 84h28" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 60C75 60 75 100 130 100h34" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 60C68 60 72 50 108 50" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" opacity="0.92" />
      <path d="M20 60C68 60 72 70 108 70" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeLinecap="round" opacity="0.92" />
    </svg>
  )
}

function RadialGraphic() {
  const spokes = Array.from({ length: 28 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 28 - Math.PI / 2
    const innerRadius = 24
    const outerRadius = 68
    const dotRadius = 1.7
    const x1 = 80 + Math.cos(angle) * innerRadius
    const y1 = 80 + Math.sin(angle) * innerRadius
    const x2 = 80 + Math.cos(angle) * outerRadius
    const y2 = 80 + Math.sin(angle) * outerRadius

    return (
      <g key={index}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx={x2} cy={y2} r={dotRadius} fill="rgba(255,255,255,0.92)" />
      </g>
    )
  })

  return (
    <svg viewBox="0 0 160 160" role="presentation" aria-hidden="true">
      {spokes}
      <rect x="62" y="62" width="36" height="36" rx="9" fill="#ff7f57" />
    </svg>
  )
}

function EInvoiceGraphic() {
  return (
    <svg viewBox="0 0 180 120" role="presentation" aria-hidden="true">
      <defs>
        <marker
          id="use-case-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L8 4L0 8Z" fill="rgba(255,255,255,0.92)" />
        </marker>
      </defs>
      <rect x="20" y="40" width="34" height="34" rx="8" fill="#ff7f57" />
      <path
        d="M54 57L124 35"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
        strokeLinecap="round"
        markerEnd="url(#use-case-arrow)"
      />
      <path
        d="M54 57H136"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
        strokeLinecap="round"
        markerEnd="url(#use-case-arrow)"
      />
      <path
        d="M54 57L112 82"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.4"
        strokeLinecap="round"
        markerEnd="url(#use-case-arrow)"
      />
      <rect x="132" y="20" width="26" height="26" rx="6" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" />
      <rect x="150" y="46" width="26" height="26" rx="6" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" />
      <rect x="130" y="72" width="26" height="26" rx="6" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" />
    </svg>
  )
}

const graphicById = {
  'direct-debit': DatabaseGraphic,
  'digital-payment': PaymentGraphic,
  'business-processes': RadialGraphic,
  einvoices: EInvoiceGraphic,
}

export function UseCasesShowcase() {
  return (
    <section className="use-cases-section" id="use-cases">
      <div className="use-cases-stage">
        {useCaseCards.map((card, index) => {
          const Graphic = graphicById[card.id]
          const sequence = `(${String(index + 1).padStart(2, '0')})`

          return (
            <article key={card.id} className="use-case-row">
              <div className="use-case-graphic-shell">
                <div className="use-case-graphic">
                  <Graphic />
                </div>
              </div>

              <div className="use-case-main">
                <p className="use-case-index">{sequence}</p>

                <div className="use-case-copy">
                  <h3>{card.title}</h3>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
