export const homeContent = {
  hero: {
    kicker: '',
    title: 'Decisions as fast as thought',
    lead: 'A new era of data engineering, designed in natural language.',
    description:
      "Don't lose time managing ETL pipelines. Our system creates a projection of the cleaned data so everything feels almost instant.",
    primaryActionLabel: 'Request access',
    secondaryActionLabel: 'See pricing',
  },
  structure: {
    kicker: 'System Structure',
    title: 'Structure and clarity across the full data system.',
    intro:
      'The platform replaces fragmented pipelines with a structured, connected software layer built for teams that want live visibility, cleaner control, and far less operational drag.',
    cards: [
      {
        title: 'Structured data flows',
        body:
          'Standardize how data moves from ingestion to cleaned views and operational outputs without losing clarity across the stack.',
        placeholder: 'warm',
      },
      {
        title: 'Real-time system visibility',
        body:
          'Track live system state, active loops, and emerging signals so the next action is visible the moment context changes.',
        placeholder: 'cool',
      },
      {
        title: 'Shared operator context',
        body:
          'Give operators, analysts, and decision makers one surface for understanding the system and steering its direction together.',
        placeholder: 'green',
      },
    ],
  },
  impact: {
    kicker: 'Impact Loop',
    rows: [
      {
        title: 'Focus on data that drives impact',
        body:
          "Track, analyze, and improve the system's performance. Focus on outcomes, measure impact with live KPIs, and uncover opportunities for continuous improvement.",
        items: [
          {
            title: 'Focus on resolution',
            body:
              'See which automations are actually resolving work, where containment drops, and which parts of the system still need human intervention.',
          },
          {
            title: 'Track and report on KPIs',
            body:
              'Follow live operational KPIs across throughput, containment, quality, and delivery so the system can be evaluated continuously, not after the fact.',
          },
          {
            title: 'Continuously improve',
            body:
              'Use feedback loops to refine prompts, routing logic, and output quality over time without rebuilding the entire stack.',
          },
        ],
        visual: 'impact',
      },
      {
        title: 'Preview system direction before it ships',
        body:
          'Model changes before they ripple through the operating layer. Compare scenarios, inspect likely effects, and guide the system with more confidence.',
        items: [
          {
            title: 'Preview shifts in system behavior',
            body:
              'Simulate how new guidance, changed thresholds, or new rules could alter the flow of outputs before those changes go live.',
          },
          {
            title: 'Compare alternative directions',
            body:
              'Review different operating paths side by side and choose the direction that fits the current business context best.',
          },
          {
            title: 'Guide execution with clearer intent',
            body:
              'Move from vague supervision to concrete directional control by giving the system cleaner guidance and seeing likely downstream effects.',
          },
        ],
        visual: 'preview',
      },
    ],
  },
  destinations: {
    kicker: 'Output Layer',
    title: 'Send outputs to any destination.',
    description:
      'Once the system understands the signal, it can package the output for any downstream tool, workflow, or operational surface your team already uses.',
    points: [
      'CRMs and revenue workflows',
      'Ad platforms and audience systems',
      'Internal tools, APIs, and warehouse destinations',
    ],
  },
}
