export interface SentinelDomainPackDefinition {
  domain: string;
  displayName: string;
  businessKeywords: string[];
  lowSignalPatterns: RegExp[];
  preferredAnalysisShapes: string[];
  metricHints: Array<{
    metricId: string;
    title: string;
    requiresAny: string[];
    requiresAll?: string[];
    description: string;
  }>;
}

export const ecommerceDomainPack: SentinelDomainPackDefinition = {
  domain: 'ecommerce',
  displayName: 'Ecommerce',
  businessKeywords: [
    'order',
    'orders',
    'revenue',
    'gmv',
    'aov',
    'customer',
    'repeat',
    'retention',
    'delivery',
    'late',
    'review',
    'category',
    'seller',
    'refund',
    'return',
    'basket',
    'cohort'
  ],
  lowSignalPatterns: [
    /row[_\s-]*count/i,
    /freshness/i,
    /product[_\s-]*name[_\s-]*length/i,
    /product[_\s-]*name[_\s-]*lenght/i,
    /description[_\s-]*length/i,
    /description[_\s-]*lenght/i,
    /photos?[_\s-]*qty/i
  ],
  preferredAnalysisShapes: [
    'time_period_comparison',
    'ranked_breakdown',
    'cohort_or_repeat_behavior',
    'delivery_sla_or_delay',
    'review_quality_shift',
    'category_concentration'
  ],
  metricHints: [
    {
      metricId: 'order_volume_trend',
      title: 'Order volume trend',
      requiresAny: ['order_id'],
      requiresAll: ['order_purchase_timestamp'],
      description: 'Track movement in order volume over time.'
    },
    {
      metricId: 'delivery_sla_rate',
      title: 'Delivery SLA rate',
      requiresAny: ['order_delivered_customer_date'],
      requiresAll: ['order_estimated_delivery_date'],
      description: 'Measure late delivery share and where it is changing.'
    },
    {
      metricId: 'review_score_trend',
      title: 'Review score trend',
      requiresAny: ['review_score'],
      requiresAll: ['review_creation_date'],
      description: 'Track customer satisfaction movement over time.'
    },
    {
      metricId: 'category_mix',
      title: 'Category mix',
      requiresAny: ['product_category_name'],
      description: 'Rank categories by volume, revenue proxy or review quality.'
    }
  ]
};

export const marketingDomainPack: SentinelDomainPackDefinition = {
  domain: 'marketing',
  displayName: 'Marketing',
  businessKeywords: [
    'spend',
    'revenue',
    'roas',
    'cac',
    'ltv',
    'conversion',
    'cvr',
    'ctr',
    'impression',
    'click',
    'campaign',
    'channel',
    'creative',
    'cohort',
    'attribution'
  ],
  lowSignalPatterns: [
    /row[_\s-]*count/i,
    /freshness/i,
    /raw[_\s-]*clicks?$/i,
    /raw[_\s-]*impressions?$/i
  ],
  preferredAnalysisShapes: [
    'spend_to_outcome_efficiency',
    'channel_or_campaign_rank',
    'conversion_funnel',
    'cohort_value',
    'budget_pacing'
  ],
  metricHints: [
    {
      metricId: 'roas',
      title: 'ROAS',
      requiresAny: ['revenue', 'purchase_value'],
      requiresAll: ['spend'],
      description: 'Compare attributed revenue to media spend.'
    },
    {
      metricId: 'cac',
      title: 'CAC',
      requiresAny: ['customer_id', 'new_customers'],
      requiresAll: ['spend'],
      description: 'Estimate acquisition cost per new customer.'
    }
  ]
};

export const saasDomainPack: SentinelDomainPackDefinition = {
  domain: 'saas',
  displayName: 'SaaS',
  businessKeywords: [
    'mrr',
    'arr',
    'churn',
    'retention',
    'activation',
    'usage',
    'seat',
    'account',
    'workspace',
    'trial',
    'conversion',
    'expansion',
    'downgrade'
  ],
  lowSignalPatterns: [
    /row[_\s-]*count/i,
    /freshness/i,
    /id[_\s-]*count/i
  ],
  preferredAnalysisShapes: [
    'retention_cohort',
    'activation_funnel',
    'account_health',
    'expansion_or_contraction',
    'usage_trend'
  ],
  metricHints: [
    {
      metricId: 'retention',
      title: 'Retention',
      requiresAny: ['account_id', 'user_id', 'workspace_id'],
      requiresAll: ['event_timestamp'],
      description: 'Measure whether entities remain active across periods.'
    },
    {
      metricId: 'activation',
      title: 'Activation',
      requiresAny: ['event_name', 'event_type'],
      requiresAll: ['user_id'],
      description: 'Find whether users reach an activation event.'
    }
  ]
};

export const defaultDomainPacks = [
  ecommerceDomainPack,
  marketingDomainPack,
  saasDomainPack
];

export const resolveDomainPack = (domain?: string) => {
  if (!domain) {
    return undefined;
  }

  return defaultDomainPacks.find((pack) => pack.domain === domain);
};
