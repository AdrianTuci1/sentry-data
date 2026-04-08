import { Link, useParams } from 'react-router-dom'
import { useCaseArticles } from '../content/useCaseArticles'
import './UseCaseArticlePage.css'

export function UseCaseArticlePage() {
  const { slug } = useParams()
  const article = useCaseArticles[slug]

  if (!article) {
    return (
      <section className="use-case-article-page">
        <div className="use-case-article-hero">
          <div className="use-case-article-hero-inner">
            <p className="use-case-article-kicker">Use Case</p>
            <h1>Article not found.</h1>
            <p className="use-case-article-intro">
              The requested use case page is not available yet.
            </p>
            <Link className="use-case-article-backlink" to="/">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="use-case-article-page">
      <div className="use-case-article-hero">
        <div className="use-case-article-hero-inner">
          <p className="use-case-article-kicker">{article.category}</p>
          <h1>{article.title}</h1>
          <p className="use-case-article-intro">{article.intro}</p>
          <Link className="use-case-article-backlink" to="/">
            Back to home
          </Link>
        </div>
      </div>

      <div className="use-case-article-body">
        {article.sections.map((section) => (
          <section key={section.title} className="use-case-article-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
