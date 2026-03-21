import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { aggregate } from 'echarts-simple-transform';
import './style.css';

// Register the aggregate transform
echarts.registerTransform(aggregate);

const ShapleyAttribution = ({ data: componentData = {} }) => {
    // Generate raw attribution data over multiple intervals (simulating simulations)
    // Format: [Channel, Score, Interval]
    const rawData = (componentData.rawData?.length > 0 ? componentData.rawData : null) || 
                    (componentData.data?.length > 0 ? componentData.data : null) || 
                    (componentData.results?.length > 0 ? componentData.results : null) || (() => {
                        const channels = ['Email', 'Search', 'Meta', 'Direct', 'Referral'];
                        const data = [];
                        channels.forEach(channel => {
                            const base = Math.random() * 30 + 10;
                            for (let year = 2020; year <= 2025; year++) {
                                // Add some variance for the boxplot calculation
                                for (let i = 0; i < 5; i++) {
                                    const score = base + (Math.random() - 0.5) * 15;
                                    data.push([channel, Math.max(0, score), year]);
                                }
                            }
                        });
                        return data;
                    })();

    const option = {
        dataset: [
            {
                id: 'raw',
                source: [['Channel', 'Score', 'Year'], ...rawData]
            },
            {
                id: 'filtered',
                fromDatasetId: 'raw',
                transform: [
                    {
                        type: 'filter',
                        config: {
                            dimension: 'Year',
                            gte: 2022
                        }
                    }
                ]
            },
            {
                id: 'aggregate',
                fromDatasetId: 'filtered',
                transform: [
                    {
                        type: 'ecSimpleTransform:aggregate',
                        config: {
                            resultDimensions: [
                                { name: 'min', from: 'Score', method: 'min' },
                                { name: 'Q1', from: 'Score', method: 'Q1' },
                                { name: 'median', from: 'Score', method: 'median' },
                                { name: 'Q3', from: 'Score', method: 'Q3' },
                                { name: 'max', from: 'Score', method: 'max' },
                                { name: 'Channel', from: 'Channel' }
                            ],
                            groupBy: 'Channel'
                        }
                    },
                    {
                        type: 'sort',
                        config: {
                            dimension: 'Q3',
                            order: 'asc'
                        }
                    }
                ]
            }
        ],
        tooltip: {
            trigger: 'axis',
            confine: true,
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            textStyle: { color: '#fff' }
        },
        xAxis: {
            name: 'Score',
            nameLocation: 'middle',
            nameGap: 30,
            scale: true,
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
            axisLabel: { color: '#6B7280', fontSize: 10 }
        },
        yAxis: {
            type: 'category',
            axisLabel: { color: '#9CA3AF', fontSize: 11 }
        },
        grid: {
            bottom: 80,
            left: 80,
            top: 40
        },
        dataZoom: [
            { type: 'inside' },
            {
                type: 'slider',
                height: 15,
                bottom: 20,
                borderColor: 'transparent',
                backgroundColor: 'rgba(255,255,255,0.05)',
                fillerColor: 'rgba(59, 130, 246, 0.2)',
                handleStyle: { color: '#3B82F6' }
            }
        ],
        series: [
            {
                name: 'Attribution Variance',
                type: 'boxplot',
                datasetId: 'aggregate',
                itemStyle: {
                    color: 'rgba(59, 130, 246, 0.3)',
                    borderColor: '#3B82F6'
                },
                encode: {
                    x: ['min', 'Q1', 'median', 'Q3', 'max'],
                    y: 'Channel',
                    itemName: ['Channel'],
                    tooltip: ['min', 'Q1', 'median', 'Q3', 'max']
                }
            },
            {
                name: 'Detail',
                type: 'scatter',
                datasetId: 'filtered',
                symbolSize: 4,
                itemStyle: {
                    color: '#EF4444',
                    opacity: 0.6
                },
                encode: {
                    x: 'Score',
                    y: 'Channel',
                    label: 'Year',
                    itemName: 'Year',
                    tooltip: ['Channel', 'Year', 'Score']
                }
            }
        ],
        animationDuration: 2000
    };

    return <ReactECharts option={option} className="micro-shapley" style={{ height: '100%', width: '100%' }} />;
};

export default ShapleyAttribution;
