// Inline mock — extracted from sentry-frontend/src/data/analyticsData-saas.json.
// Only the 'marketing-roas' entry is consumed by HeroMicroWidgets.
const analyticsData = [
    {
        id: 'marketing-roas',
        type: 'weather',
        title: 'MRR Velocity',
        subtitle: 'Recurring Revenue Expansion Rate',
        footerText: 'Net new + expansion MRR',
        colorTheme: 'theme-productivity',
        gridSpan: 'default',
        data: {
            value: '8.4',
            unit: '%',
            trendValue: '+1.1 pts',
            trendDirection: 'up',
            trendTone: 'positive',
            trendLabel: 'vs yesterday',
        },
    },
];

export default analyticsData;
