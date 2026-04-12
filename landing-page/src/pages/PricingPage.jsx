import { useState } from 'react'
import { Link } from 'react-router-dom'
import './PricingPage.css'

const pricingPlans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: '/month',
    badge: null,
    accent: 'pricing-tier-surface-highlight',
    ctaLabel: 'Request access',
    ctaHref: '/request-access',
    summary: 'For testing a workflow before you wire the full stack.',
    highlights: [
      '1 active project',
      'Up to 5 GB analyzed / month',
      'Daily refresh',
      '3 saved views',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$100',
    cadence: '/month',
    badge: null,
    accent: 'pricing-tier-surface',
    ctaLabel: 'Request access',
    ctaHref: '/request-access',
    summary: 'For lean teams shipping their first automated data science workflows.',
    highlights: [
      '3 active projects',
      'Up to 40 GB analyzed / month',
      'Hourly refresh',
      '20 saved views',
      'Scheduled exports',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$250',
    cadence: '/month',
    badge: 'Popular',
    accent: 'pricing-tier-surface-popular',
    ctaLabel: 'Request access',
    ctaHref: '/request-access',
    summary: 'For production-grade orchestration across multiple datasets and teams.',
    highlights: [
      '10 active projects',
      'Up to 120 GB analyzed / month',
      '15 min refresh',
      'Unlimited saved views',
      'Alerts and API access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'pricing',
    badge: null,
    accent: 'pricing-tier-surface-enterprise',
    ctaLabel: 'Talk to sales',
    ctaHref: '/support',
    summary: 'For larger organizations with higher volumes, governance and private deployment needs.',
    highlights: [
      'Unlimited projects',
      'Custom data volume',
      'Dedicated infrastructure options',
      'Advanced governance',
      'Priority SLA support',
    ],
  },
]

const comparisonRows = [
  {
    label: 'Monthly price',
    values: ['$0', '$100', '$250', 'Custom'],
  },
  {
    label: 'Active projects',
    values: ['1', '3', '10', 'Unlimited'],
  },
  {
    label: 'GB analyzed / month',
    values: ['Up to 5', 'Up to 40', 'Up to 120', 'Custom'],
  },
  {
    label: 'Refresh cadence',
    values: ['Daily', 'Hourly', '15 min', 'Custom SLA'],
  },
  {
    label: 'Saved views',
    values: ['3', '20', 'Unlimited', 'Unlimited'],
  },
  {
    label: 'Exports',
    values: ['CSV', 'CSV + Sheets', 'API + Warehouse', 'Custom pipelines'],
  },
  {
    label: 'Support',
    values: ['Community', 'Email', 'Priority', 'Dedicated'],
  },
]

function getRecommendedPlan(gigabytes) {
  if (gigabytes <= 5) {
    return pricingPlans[0]
  }

  if (gigabytes <= 40) {
    return pricingPlans[1]
  }

  if (gigabytes <= 120) {
    return pricingPlans[2]
  }

  return pricingPlans[3]
}

function getUtilizationCopy(gigabytes) {
  if (gigabytes <= 5) {
    return 'Light exploration, prototypes and one production-ready dashboard.'
  }

  if (gigabytes <= 40) {
    return 'Great for a small team syncing a few sources and recurring outputs.'
  }

  if (gigabytes <= 120) {
    return 'Built for broader production use with more refreshes and team usage.'
  }

  return 'You are likely in custom infrastructure territory with larger recurring workloads.'
}

function renderComparisonValue(value) {
  if (value === true) {
    return 'Included'
  }

  if (value === false) {
    return 'Not included'
  }

  return value
}

export function PricingPage() {
  const [gigabytes, setGigabytes] = useState(32)
  const recommendedPlan = getRecommendedPlan(gigabytes)
  const usageCopy = getUtilizationCopy(gigabytes)

  return (
    <section className="pricing-page">
      <div className="pricing-shell">
        <div className="pricing-header">
          <div className="pricing-header-copy">
            <p className="pricing-kicker">Pricing</p>
            <h1>Simple pricing for automated data science teams.</h1>
            <p className="pricing-copy">
              Start free, move into production when the workflows prove out, and scale into custom
              infrastructure only when the analyzed data volume really demands it.
            </p>
          </div>

          <div className="pricing-header-note">
            <p className="pricing-header-label">What&apos;s included</p>
            <p>
              Every plan includes source ingestion, transformation pipelines, business-ready views,
              and orchestration for recurring outputs.
            </p>
          </div>
        </div>

        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.id} className="pricing-tier">
              <div className={`pricing-tier-surface ${plan.accent}`}>
                <div className="pricing-tier-topline">
                  <h2>{plan.name}</h2>
                  {plan.badge ? <span className="pricing-tier-badge">{plan.badge}</span> : null}
                </div>

                <p className="pricing-tier-summary">{plan.summary}</p>

                <div className="pricing-tier-price-row">
                  <strong>{plan.price}</strong>
                  <span>{plan.cadence}</span>
                </div>
              </div>

              <Link className="pricing-tier-button" to={plan.ctaHref}>
                {plan.ctaLabel}
              </Link>

              <ul className="pricing-tier-list">
                {plan.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="pricing-estimator">
          <div className="pricing-estimator-copy">
            <p className="pricing-eyebrow">Monthly estimator</p>
            <h2>Estimate your cost from analyzed GB per month.</h2>
            <p>
              Use the slider to approximate how much cleaned data you expect us to process each
              month. We&apos;ll match that to the best-fit plan.
            </p>

            <label className="pricing-range-field" htmlFor="pricing-gigabytes">
              <span>GB analyzed each month</span>
              <div className="pricing-range-meta">
                <strong>{gigabytes} GB</strong>
                <span>0 - 180 GB+</span>
              </div>
            </label>

            <input
              id="pricing-gigabytes"
              className="pricing-range"
              type="range"
              min="0"
              max="180"
              step="1"
              value={gigabytes}
              onChange={(event) => setGigabytes(Number(event.target.value))}
            />

            <p className="pricing-estimator-footnote">{usageCopy}</p>
          </div>

          <div className={`pricing-estimator-card ${recommendedPlan.accent}`}>
            <div className="pricing-estimator-card-head">
              <div>
                <p className="pricing-eyebrow">Recommended plan</p>
                <h3>{recommendedPlan.name}</h3>
              </div>

              <div className="pricing-estimator-price">
                <strong>{recommendedPlan.price}</strong>
                <span>{recommendedPlan.cadence}</span>
              </div>
            </div>

            <p className="pricing-estimator-summary">{recommendedPlan.summary}</p>

            <ul className="pricing-estimator-list">
              {recommendedPlan.highlights.slice(0, 4).map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>

            <Link className="pricing-estimator-button" to={recommendedPlan.ctaHref}>
              {recommendedPlan.ctaLabel}
            </Link>
          </div>
        </div>

        <div className="pricing-comparison">
          <div className="pricing-comparison-copy">
            <p className="pricing-eyebrow">Comparison</p>
            <h2>Compare the plans at a glance.</h2>
            <p>
              The table below keeps the decision grounded in the limits that usually matter first:
              projects, refresh frequency, data volume and support level.
            </p>
          </div>

          <div className="pricing-comparison-table-shell">
            <table className="pricing-comparison-table">
              <thead>
                <tr>
                  <th>Plan details</th>
                  {pricingPlans.map((plan) => (
                    <th key={plan.id}>{plan.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-${pricingPlans[index].id}`}>
                        {renderComparisonValue(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
