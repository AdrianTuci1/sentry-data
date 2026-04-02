import React from 'react';
import ReactECharts from 'echarts-for-react';

const AnomalyStream = ({ data }) => {
    const services = ['Google Ads', 'Meta Ads', 'SEO', 'Email Marketing', 'Direct Traffic', 'Affiliate', 'Display Ads'];

    // Generate dispersion mock data with service context
    const dispersionData = [];
    for (let i = 0; i < 250; i++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const x = Math.random() * 1000;
        const y = Math.random() * 100000 + 20000;
        // Format: [x, y, serviceName]
        dispersionData.push([x, y, service]);
    }

    // Add specific anomalies with clear labels
    dispersionData.push(
        [900, 150000, 'Meta Ads (Spike)'],
        [100, 160000, 'Google Ads (Alert)'],
        [500, 10000, 'SEO (Anomaly)']
    );

    const option = {
        grid: {
            top: '15%',
            bottom: '15%',
            left: '10%',
            right: '15%',
            containLabel: true
        },
        visualMap: {
            min: 20000,
            max: 160000,
            dimension: 1,
            orient: 'vertical',
            right: 0,
            top: 'center',
            text: ['HIGH', 'LOW'],
            calculable: true,
            itemWidth: 10,
            itemHeight: 80,
            textStyle: { color: '#6B7280', fontSize: 10 },
            inRange: {
                color: ['#f2c31a', '#24b7f2']
            }
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const [x, y, service] = params.data;
                return `
                    <div style="padding: 4px;">
                        <div style="font-weight: bold; color: #9CA3AF; margin-bottom: 4px;">${service}</div>
                        <div style="font-size: 12px;">Variance: <span style="color: #24b7f2;">${y.toLocaleString()}</span></div>
                        <div style="font-size: 12px; opacity: 0.7;">Frequency: ${x.toFixed(0)}</div>
                    </div>
                `;
            },
            axisPointer: {
                type: 'cross'
            }
        },
        xAxis: [
            {
                type: 'value',
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
                axisLabel: { color: '#6B7280', fontSize: 9 }
            }
        ],
        yAxis: [
            {
                type: 'value',
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
                axisLabel: { color: '#6B7280', fontSize: 9 }
            }
        ],
        series: [
            {
                name: 'service-dispersion',
                type: 'scatter',
                symbolSize: (data) => {
                    // Make anomalies larger
                    return data[1] > 140000 || data[1] < 15000 ? 8 : 4;
                },
                data: dispersionData,
                itemStyle: {
                    opacity: 0.8
                }
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default AnomalyStream;
