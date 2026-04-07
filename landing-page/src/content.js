export const navigation = [
  { label: 'Home', href: '/#home' },
  { label: 'Use Cases', href: '/#use-cases' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Support', href: '/#support' },
]

export const useCaseDropdownItems = [
  {
    label: 'Ecommerce',
    description: 'Margins, cohorts, ROAS and merchandising signals.',
    href: '/use-cases/ecommerce',
  },
  {
    label: 'Marketing',
    description: 'Attribution, spend pacing and channel performance.',
    href: '/use-cases/marketing',
  },
  {
    label: 'Logistics',
    description: 'Inventory flows, fulfillment delays and route efficiency.',
    href: '/use-cases/logistics',
  },
  {
    label: 'SaaS',
    description: 'Usage, retention, expansion and revenue health.',
    href: '/use-cases/saas',
  },
  {
    label: 'Cybersecurity',
    description: 'Alert triage, anomaly detection and operational visibility.',
    href: '/use-cases/cybersecurity',
  },
  {
    label: 'LLM Training',
    description: 'Dataset quality, pipeline monitoring and feedback loops.',
    href: '/use-cases/llm-training',
  },
]

export const useCaseCards = [
  {
    id: 'direct-debit',
    title: 'Use fully managed or bring your own warehouse.',
  },
  {
    id: 'digital-payment',
    title: 'We detect anomalies and correct them autonomously.',
  },
  {
    id: 'business-processes',
    title: 'Steer agents toward new goals.',
  },
  {
    id: 'einvoices',
    title: 'Allow agents to run actions based on your data.',
  },
]

export const orchestrationLayers = [
  {
    id: '01',
    label: 'Client Layer',
    title: 'Web interface',
    description:
      'A polished operator surface for dashboards, approvals, alerts, and business workflows.',
    tags: ['Dashboards', 'Reports', 'Approvals'],
  },
  {
    id: '02',
    label: 'Agent Layer',
    title: 'AI agents at work',
    description:
      'Specialized agents plan, clean, enrich, verify, and route data into reliable outputs.',
    tags: ['Planner', 'Cleaner', 'Reasoner', 'Monitor'],
  },
  {
    id: '03',
    label: 'Source Layer',
    title: 'Connected data sources',
    description:
      'Warehouses, SaaS tools, ad platforms, billing systems, and product telemetry feed the stack.',
    tags: ['Warehouse', 'CRM', 'Ads', 'Billing', 'Product', 'Support'],
  },
]

export const orchestrationBenefits = [
  'Clear separation between interface, execution, and ingestion.',
  'Agents can work continuously without exposing backend complexity to users.',
  'New sources plug into the base layer without redesigning the operator experience.',
  'A professional, explainable system that scales from reporting to action.',
]
