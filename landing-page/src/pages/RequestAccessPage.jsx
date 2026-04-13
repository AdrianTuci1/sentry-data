import { useState } from 'react'
import './RequestAccessPage.css'

export function RequestAccessPage() {
  const [status, setStatus] = useState('idle') // idle, submitting, success, error
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    purpose: '',
    volume: '',
  })

  const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLScbMh2j9Mzr5EzepzzzuGy5PRl-8zFUntXTjSqPYiG4AgXkog/formResponse'
  
  const ENTRY_IDS = {
    name: 'entry.899831206',
    email: 'entry.1355133133',
    purpose: 'entry.1972333980',
    volume: 'entry.1894301936',
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')

    const data = new FormData()
    data.append(ENTRY_IDS.name, formData.name)
    data.append(ENTRY_IDS.email, formData.email)
    data.append(ENTRY_IDS.purpose, formData.purpose)
    data.append(ENTRY_IDS.volume, formData.volume)

    try {
      await fetch(GOOGLE_FORM_ACTION, {
        method: 'POST',
        body: data,
        mode: 'no-cors',
      })
      
      // Since no-cors doesn't allow access to the response, 
      // we assume success if the fetch doesn't throw.
      setStatus('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Submission error:', err)
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <section className="request-access-page">
        <div className="request-access-shell">
          <div className="request-access-success">
            <div className="success-icon">✓</div>
            <h1>Request Received.</h1>
            <p>
              Thank you for sharing your project details. Our team will review your application
              and get back to you shortly with the next steps.
            </p>
            <button className="request-access-submit" onClick={() => setStatus('idle')}>
              Send another request
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="request-access-page">
      <div className="request-access-shell">
        <div className="request-access-copy">
          <p className="request-access-kicker">Request access</p>
          <h1>Tell us what you want to build.</h1>
          <p>
            Share a few details about your data surface and intended workflow. We will use this to
            route the right next step.
          </p>
        </div>

        <form className="request-access-form" onSubmit={handleSubmit}>
          <label className="request-access-field" htmlFor="request-access-name">
            <span>Name</span>
            <input
              id="request-access-name"
              name="name"
              type="text"
              autoComplete="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label className="request-access-field" htmlFor="request-access-email">
            <span>Email</span>
            <input
              id="request-access-email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="request-access-field" htmlFor="request-access-purpose">
            <span>Purpose of use</span>
            <textarea
              id="request-access-purpose"
              name="purpose"
              rows="5"
              placeholder="Dashboards, recurring reports, agent workflows, data cleanup..."
              value={formData.purpose}
              onChange={handleChange}
              required
            />
          </label>

          <label className="request-access-field" htmlFor="request-access-volume">
            <span>Estimated data volume</span>
            <input
              id="request-access-volume"
              name="volume"
              type="text"
              placeholder="Example: 40 GB per month"
              value={formData.volume}
              onChange={handleChange}
              required
            />
          </label>

          {status === 'error' && (
            <p className="request-access-error">
              Something went wrong. Please try again or email us directly at hello@parrotos.com
            </p>
          )}

          <button
            className="request-access-submit"
            type="submit"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Sending...' : 'Send request'}
          </button>
        </form>
      </div>
    </section>
  )
}
