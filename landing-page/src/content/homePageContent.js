import anywhereOutputIcon from '../../assets/output/anywhere.png'
import hubspotOutputIcon from '../../assets/output/hubspot.png'
import metaOutputIcon from '../../assets/output/meta.png'

export const heroContent = {
  kicker: 'Context-aware data operations',
  titlePrefix: 'Let your data run your business,',
  titleEmphasis: 'without the busywork.',
  description:
    'Turn messy operational data into clear views, useful recommendations, and actions your team can send straight into the tools it already uses.',
  primaryActionLabel: 'Join waitlist',
}

export const pipelineFlowContent = {
  meta: {
    leftLabel: 'StatsParrot Gold',
    rightLabel: 'DECISION PIPELINE',
  },
  title: 'We take raw data and give you immediate decisions.',
  description:
    'Our high-performance neural engine creates a virtual projection of your cleaned data, so your team gets decision-ready outputs without relying on classic ETL pipelines.',
  inputs: [
    'Ad spend, campaign, and channel data',
    'Orders, revenue, and refund events',
    'Customer cohorts and retention history',
    'Subscriptions, trials, and churn signals',
    'Sessions, funnels, and conversion journeys',
    'Catalog, pricing, and contribution margin data',
  ],
  views: [
    'Executive growth dashboard',
    'LTV to CAC view',
    'Channel efficiency and ROAS',
    'Retention and cohort analysis',
    'Payback and margin visibility',
    'Decision briefs for operators',
  ],
  layout: {
    leftGroupOffset: '7.75rem',
    centerOffset: '7.5rem',
    rightGroupOffset: '9.25rem',
  },
}

export const liveInsightsBridgeContent = {
  header: {
    kicker: 'Live context routing',
    title: 'The right signal, right when it matters.',
    description:
      'The platform detects what matters now and surfaces the next action.',
    tabsAriaLabel: 'Industry views',
  },
  domains: [
    {
      label: 'Ecommerce',
      eyebrow:
        'Campaign efficiency, margin pressure, and revenue in one view.',
      prompt: 'Which campaign is hurting margin most?',
      response:
        'Retargeting is still driving volume, but margin is dropping fastest there. I would cut that audience first.',
    },
    {
      label: 'SaaS',
      eyebrow:
        'Product usage, trial intent, and revenue health in one view.',
      prompt: 'Which trials are closest to paid?',
      response:
        'Accounts with repeat exports, a second admin, and deeper activation look closest to conversion. I would send those to sales now.',
    },
    {
      label: 'Cybersecurity',
      eyebrow:
        'Threat confidence, asset exposure, and urgency in one view.',
      prompt: 'Which alert cluster needs escalation first?',
      response:
        'The cluster combining identity anomalies with endpoint suppression is the top priority.',
    },
  ],
  dock: {
    assistantLabel: 'Workspace copilot',
    aiSystemLabel: 'AI analyst',
    liveContextLabel: 'Live context',
    inputPlaceholder: 'Ask a business question in plain English...',
    closeChatAriaLabel: 'Close chat',
    inputAriaLabel: 'AI chat input',
    voiceInputAriaLabel: 'Voice input',
    sendMessageAriaLabel: 'Send message',
  },
  output: {
    title: 'Send the answer straight into the tools your team uses.',
    destinations: [
      {
        label: 'HubSpot',
        meta: 'Send qualified signals to CRM workflows.',
        iconSrc: hubspotOutputIcon,
      },
      {
        label: 'Meta',
        meta: 'Refresh audiences and reactivate campaigns.',
        iconSrc: metaOutputIcon,
      },
      {
        label: 'Any workflow',
        meta: 'Push structured outputs anywhere.',
        iconSrc: anywhereOutputIcon,
      },
    ],
    request: {
      method: 'POST',
      url: {
        protocol: 'https://',
        domain: 'api.partner.app',
        path: '/v1/forward',
      },
      tabs: [
        { label: 'Params' },
        { label: 'Headers', badge: '1' },
        { label: 'Auth' },
        { label: 'Body', active: true, dot: true },
      ],
      lines: [
        [{ type: 'brace', text: '{' }],
        [
          { type: 'indent', text: '  ' },
          { type: 'key', text: '"workspaceId"' },
          { type: 'punct', text: ': ' },
          { type: 'string', text: '"{{workspace_id}}"' },
          { type: 'comma', text: ',' },
        ],
        [
          { type: 'indent', text: '  ' },
          { type: 'key', text: '"signal"' },
          { type: 'punct', text: ': ' },
          { type: 'string', text: '"{{insight_summary}}"' },
          { type: 'comma', text: ',' },
        ],
        [
          { type: 'indent', text: '  ' },
          { type: 'key', text: '"priority"' },
          { type: 'punct', text: ': ' },
          { type: 'string', text: '"{{ai_priority}}"' },
          { type: 'comma', text: ',' },
        ],
        [
          { type: 'indent', text: '  ' },
          { type: 'key', text: '"payload"' },
          { type: 'punct', text: ': ' },
          { type: 'variable', text: '{{mapped_payload}}' },
        ],
        [{ type: 'brace', text: '}' }],
      ],
    },
  },
}

export const architectureContent = {
  title: 'Connect once. Adapt as you grow.',
  intro:
    'Keep the context, define the signals, and route decisions where work happens.',
  steps: [
    'Connect your core sources.',
    'Define the signals your team cares about.',
    'Send outputs into dashboards and workflows.',
  ],
  primaryActionLabel: 'Join waitlist',
  secondaryActionLabel: 'See pricing',
}
