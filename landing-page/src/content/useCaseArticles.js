export const useCaseArticles = {
  ecommerce: {
    slug: 'ecommerce',
    category: 'Use Case',
    title: 'Ecommerce intelligence for teams that need margin clarity every day.',
    intro:
      'Bring sales, catalog, paid media, returns, and fulfillment data into one operating layer so ecommerce teams can move faster without stitching reports by hand.',
    sections: [
      {
        title: 'Where ecommerce teams lose time',
        paragraphs: [
          'Most ecommerce operators work across storefront data, ad platforms, web analytics, warehouse events, and finance exports. The challenge is not just volume. The problem is that each source describes performance differently, so teams spend too much time reconciling orders, discounts, returns, and campaign costs before they can make a decision.',
          'That delay usually shows up in slow merchandising reactions, unclear channel profitability, and weekly reporting cycles that arrive after the opportunity has already passed.',
        ],
      },
      {
        title: 'What the article view should surface',
        paragraphs: [
          'For this use case, the article focuses on a simple operational narrative: what changed in revenue, what changed in margin, which products or cohorts drove the shift, and where the team should investigate next.',
          'The supporting insights should make it easy to move from top-line health into deeper slices such as first-order versus repeat-order revenue, blended ROAS by campaign family, return-sensitive margin, and inventory pressure on fast-moving SKUs.',
        ],
      },
      {
        title: 'How the platform helps',
        paragraphs: [
          'The platform normalizes order events, marketing spend, product metadata, and operational costs into a common layer that can be queried consistently. Agents can then detect unusual shifts, explain likely drivers, and package the result into a short brief that is usable by founders, ecommerce managers, and performance marketers.',
          'Instead of reading five dashboards and a spreadsheet export, the team gets a single artifact with trend context, anomaly explanations, and a clear next action.',
        ],
      },
      {
        title: 'Typical questions answered',
        paragraphs: [
          'Which campaigns are creating revenue but eroding contribution margin? Which collections have strong demand but weak stock coverage? Are returns clustering around a product family, a traffic source, or a specific promotion window?',
          'These are the kinds of questions that fit naturally into the article format because they combine metrics, context, and a recommendation instead of forcing the operator to assemble the story alone.',
        ],
      },
    ],
  },
  marketing: {
    slug: 'marketing',
    category: 'Use Case',
    title: 'Marketing reporting that explains performance, not just spend.',
    intro:
      'Turn fragmented campaign, web, CRM, and revenue signals into a readable operating article for teams that need faster attribution and better budget decisions.',
    sections: [
      {
        title: 'Why marketing data stays fragmented',
        paragraphs: [
          'Performance teams usually work with multiple ad channels, landing page tools, CRM stages, and product analytics events. Even when every platform has a dashboard, the leadership question remains difficult: which efforts created efficient pipeline or revenue, and which only created surface-level activity.',
          'As a result, marketers often spend reporting cycles aligning definitions for leads, qualified pipeline, influenced revenue, and payback instead of improving campaigns.',
        ],
      },
      {
        title: 'What the article should communicate',
        paragraphs: [
          'A strong marketing article needs to summarize pacing, channel efficiency, funnel conversion, and revenue contribution in one place. The core job is to connect upper-funnel activity to business outcomes without making the reader dig through campaign managers and BI views.',
          'That means the text should explain what changed, which channels drove the change, whether the shift is healthy or misleading, and what budget move is justified next.',
        ],
      },
      {
        title: 'How the platform structures the story',
        paragraphs: [
          'The platform can combine spend, impressions, clicks, sessions, form fills, CRM progression, and closed revenue into a consistent analytical layer. Agents use that layer to identify meaningful movements such as rising spend with flat pipeline quality, strong creative performance with weak landing-page conversion, or a delayed revenue lift from branded search.',
          'The output is not only descriptive. It also gives a decision-ready perspective for reallocation, experimentation, and executive communication.',
        ],
      },
      {
        title: 'Typical insights in this view',
        paragraphs: [
          'A marketing team might see that paid social is driving lower-cost leads but weaker qualification, while search is producing fewer leads with higher revenue efficiency. Another week, the article may highlight that one audience segment is saturating even though top-line CTR still looks healthy.',
          'This is where the article format adds value: it makes the relationship between signal quality and business value explicit.',
        ],
      },
    ],
  },
  logistics: {
    slug: 'logistics',
    category: 'Use Case',
    title: 'Logistics visibility that connects operations, delays, and service outcomes.',
    intro:
      'Convert shipment, warehouse, route, and support data into a single readable view of flow efficiency and operational risk.',
    sections: [
      {
        title: 'The operational reporting gap',
        paragraphs: [
          'Logistics data usually lives across warehouse systems, transport partners, order management, and customer support tools. Each source captures a different part of the story, which makes it difficult to understand whether delays come from picking, carrier handoff, route performance, demand spikes, or documentation errors.',
          'When these signals stay separate, teams react late and often solve symptoms instead of causes.',
        ],
      },
      {
        title: 'What the article needs to show',
        paragraphs: [
          'For this use case, the article should quickly answer three questions: where the network is healthy, where flow is degrading, and which nodes require intervention first. A simple page is especially useful here because operations leaders need a brief they can scan quickly and discuss across teams.',
          'The written narrative should connect fulfillment speed, on-time delivery, backlog growth, exception rates, and customer-impact signals in one sequence.',
        ],
      },
      {
        title: 'How the platform supports decisions',
        paragraphs: [
          'By normalizing event timestamps, location metadata, carrier performance, and exception categories, the platform can detect clusters of delay and expose their operational pattern. Agents can then summarize whether the issue is localized, recurring, or systemic.',
          'That gives planners and operations managers a much clearer starting point for rerouting, staffing, inventory rebalancing, or carrier escalation.',
        ],
      },
      {
        title: 'Typical insights in practice',
        paragraphs: [
          'An article might reveal that one warehouse is keeping picking SLAs but losing time at carrier pickup. Another might show that a route family looks healthy on average while a subset of high-value deliveries is slipping due to customs or documentation exceptions.',
          'The purpose of the article is to surface those patterns with enough context to act confidently.',
        ],
      },
    ],
  },
  saas: {
    slug: 'saas',
    category: 'Use Case',
    title: 'SaaS reporting that links product usage to retention and expansion.',
    intro:
      'Turn product events, billing data, CRM context, and support signals into a clear operating article for revenue and product teams.',
    sections: [
      {
        title: 'Why SaaS teams need a joined view',
        paragraphs: [
          'Product usage, subscriptions, customer success notes, and revenue outcomes rarely sit in the same system. That separation makes it hard to explain why one segment expands, why another churns, or which product behaviors are most predictive of long-term value.',
          'Without a shared layer, teams end up arguing over definitions like activation, healthy usage, qualified expansion, and preventable churn.',
        ],
      },
      {
        title: 'What the article should emphasize',
        paragraphs: [
          'The article view should connect adoption, retention, account health, and revenue movement in one narrative. Instead of listing standalone metrics, it should explain which cohorts are strengthening, which accounts are slipping, and what behaviors appear to drive those shifts.',
          'That makes the page useful for product leaders, growth teams, and customer success managers at the same time.',
        ],
      },
      {
        title: 'How the platform makes it usable',
        paragraphs: [
          'The platform can join event-level usage, account attributes, plan data, support touchpoints, and pipeline context into a single analytical model. Agents then summarize changes across activation, feature adoption, seat growth, renewal probability, and contraction risk.',
          'Because the output is written as a compact article, teams get both a diagnosis and a communication layer they can reuse internally.',
        ],
      },
      {
        title: 'Typical questions it answers',
        paragraphs: [
          'Which usage milestones correlate with expansion in the current quarter? Which customer segments show healthy login activity but weak depth of adoption? Are support-heavy accounts improving after onboarding changes, or are they still carrying churn risk?',
          'These are precisely the questions that benefit from a structured narrative plus focused evidence.',
        ],
      },
    ],
  },
  cybersecurity: {
    slug: 'cybersecurity',
    category: 'Use Case',
    title: 'Cybersecurity reporting that reduces alert noise and sharpens response priorities.',
    intro:
      'Synthesize alert streams, asset context, identity signals, and incident outcomes into a concise operational article.',
    sections: [
      {
        title: 'Why security teams need synthesis',
        paragraphs: [
          'Security operations often deal with multiple tools that each produce a partial view: SIEM alerts, endpoint events, identity logs, vulnerability scans, and case management updates. The challenge is not collecting alerts. The challenge is turning them into a prioritized understanding of exposure and response needs.',
          'When that synthesis does not exist, teams burn time on repetitive triage and leadership gets flooded with noisy summaries that do not clarify business risk.',
        ],
      },
      {
        title: 'What the article format changes',
        paragraphs: [
          'A well-structured article can describe alert volume, severity shifts, recurring entities, control coverage, and investigation outcomes in a way that reads like an operational brief rather than a raw event dump.',
          'This makes the page useful across SOC analysts, security managers, and executives who need clarity on what requires attention now.',
        ],
      },
      {
        title: 'How the platform helps teams focus',
        paragraphs: [
          'The platform can correlate alerts with user identity, asset criticality, previous incidents, and known exceptions. Agents use that context to identify repeated patterns, suppress low-signal noise, and surface clusters that suggest lateral movement, policy drift, or emerging attack activity.',
          'The resulting article gives teams a much better starting point for escalation, investigation, and stakeholder communication.',
        ],
      },
      {
        title: 'Typical insights highlighted',
        paragraphs: [
          'One report may show that a spike in endpoint detections is mostly tied to a low-risk software rollout, while another may reveal a small set of identities generating high-risk sequences across multiple systems. The difference between those two cases matters, and the article should make that difference obvious.',
          'That is the core value of the page: less noise, more direction.',
        ],
      },
    ],
  },
  'llm-training': {
    slug: 'llm-training',
    category: 'Use Case',
    title: 'LLM training operations with clearer dataset quality and feedback visibility.',
    intro:
      'Organize training data, evaluation signals, annotation feedback, and pipeline health into a readable article that supports iteration at speed.',
    sections: [
      {
        title: 'Why training pipelines become hard to read',
        paragraphs: [
          'LLM teams often manage multiple sources of truth at once: raw corpora, filtered datasets, annotation rounds, evaluation results, preference signals, and infrastructure logs. The complexity grows quickly because quality issues in one layer can surface much later in another.',
          'Without a unified operating view, teams struggle to see whether a regression came from data freshness, labeling drift, prompt formatting, deduplication issues, or evaluator inconsistency.',
        ],
      },
      {
        title: 'What the article should make visible',
        paragraphs: [
          'This article should explain pipeline health in a practical sequence: dataset changes, quality signals, training or evaluation deviations, and the most likely reasons behind them. The goal is to give researchers and operations teams one shared page they can use before starting deeper analysis.',
          'It should also make room for decision context, such as whether a regression is isolated, expected, or severe enough to block a release.',
        ],
      },
      {
        title: 'How the platform supports the workflow',
        paragraphs: [
          'The platform can combine ingestion metrics, curation outputs, annotation statistics, evaluation benchmarks, and feedback loops into a consistent monitoring layer. Agents then summarize distribution shifts, failure clusters, unstable benchmarks, and throughput bottlenecks in a short operational narrative.',
          'That helps the team move from disconnected metrics to a clearer plan for retraining, relabeling, or pipeline correction.',
        ],
      },
      {
        title: 'Typical questions answered',
        paragraphs: [
          'Did model quality drop because of a narrower dataset slice, noisier preference labels, or a mismatch between training prompts and evaluation prompts? Are certain benchmark regressions aligned with a specific data source or annotation vendor? Is throughput slowing because of infrastructure pressure or review backlog?',
          'These are the kinds of questions the article is designed to support before the team drills into raw artifacts.',
        ],
      },
    ],
  },
}
