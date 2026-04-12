import './SupportPage.css'
import logo from '../../assets/logo.png'

const supportOptions = [
  {
    title: 'Request access',
    body:
      'Tell us about your team, your data surface, and the outputs you want to automate. We will reply with the best next step.',
  },
  {
    title: 'Sales and deployment',
    body:
      'For larger environments, private infrastructure, or custom governance requirements, we can scope the right setup together.',
  },
  {
    title: 'Operator support',
    body:
      'If you are already evaluating the platform, we can help with onboarding, workflow design, and system guidance.',
  },
]

export function SupportPage() {
  return (
    <section className="support-page">
      <div className="support-shell">
        <div className="support-header">
          <div>
            <p className="support-kicker">Support</p>
            <h1>Reach the team behind the system.</h1>
          </div>

          <div className="support-intro">
            <p>
              Whether you want access, a walkthrough, or help shaping a deployment, we can help
              you move from evaluation to a working operating layer.
            </p>
          </div>
        </div>

        <div className="support-grid">
          {supportOptions.map((option) => (
            <article key={option.title} className="support-card">
              <h2>{option.title}</h2>
              <p>{option.body}</p>
            </article>
          ))}
        </div>

        <div className="support-contact-panel">
          <p className="support-kicker">Contact</p>
          <div className="support-contact-row">
            <div>
              <img className="support-contact-logo" src={logo} alt="" />
              <p>Use this address for access requests, sales conversations, and support.</p>
            </div>

            <a className="support-contact-action" href="mailto:hello@parrotos.com">
              Email us
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
