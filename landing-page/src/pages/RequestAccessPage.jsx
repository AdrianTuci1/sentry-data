import './RequestAccessPage.css'

export function RequestAccessPage() {
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

        <form
          className="request-access-form"
          action="mailto:hello@parrotos.com"
          method="post"
          encType="text/plain"
        >
          <label className="request-access-field" htmlFor="request-access-name">
            <span>Name</span>
            <input id="request-access-name" name="name" type="text" autoComplete="name" required />
          </label>

          <label className="request-access-field" htmlFor="request-access-email">
            <span>Email</span>
            <input
              id="request-access-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="request-access-field" htmlFor="request-access-purpose">
            <span>Purpose of use</span>
            <textarea
              id="request-access-purpose"
              name="purpose_of_use"
              rows="5"
              placeholder="Dashboards, recurring reports, agent workflows, data cleanup..."
              required
            />
          </label>

          <label className="request-access-field" htmlFor="request-access-volume">
            <span>Estimated data volume</span>
            <input
              id="request-access-volume"
              name="estimated_data_volume"
              type="text"
              placeholder="Example: 40 GB per month"
              required
            />
          </label>

          <button className="request-access-submit" type="submit">
            Send request
          </button>
        </form>
      </div>
    </section>
  )
}
