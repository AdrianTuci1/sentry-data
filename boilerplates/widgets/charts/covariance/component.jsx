import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const CovarianceMatrix = ({ data = {} }) => {
    const fields = (data.labels?.length > 0 ? data.labels : null) || 
                   (data.fields?.length > 0 ? data.fields : null) || 
                   ['Spend', 'Impr', 'Clicks', 'Conv'];
    
    const matrixData = (data.matrix?.length > 0 ? data.matrix : null) || 
                       (data.data?.length > 0 ? data.data : null) || 
                       (data.results?.length > 0 ? data.results : null) || [
                           [0, 0, 1], [0, 1, 0.8], [0, 2, 0.3], [0, 3, 0.1],
                           [1, 0, 0.8], [1, 1, 1], [1, 2, 0.5], [1, 3, 0.2],
                           [2, 0, 0.3], [2, 1, 0.5], [2, 2, 1], [2, 3, 0.6],
                           [3, 0, 0.1], [3, 1, 0.2], [3, 2, 0.6], [3, 3, 1]
                       ];

    const option = {
        tooltip: { position: 'top' },
        grid: { left: '15%', right: '5%', top: '5%', bottom: '15%' },
        xAxis: {
            type: 'category',
            data: fields,
            splitArea: { show: true },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        yAxis: {
            type: 'category',
            data: fields,
            splitArea: { show: true },
            axisLabel: { color: '#9CA3AF', fontSize: 10 }
        },
        visualMap: {
            min: 0,
            max: 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            show: false,
            inRange: {
                color: ['#1F2937', '#6366F1', '#EC4899']
            }
        },
        series: [{
            name: 'Covariance',
            type: 'heatmap',
            data: matrixData,
            label: {
                show: true,
                color: '#fff',
                fontSize: 10,
                formatter: (p) => p.data[2].toFixed(2)
            },
            itemStyle: {
                borderColor: '#111827',
                borderWidth: 1
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default CovarianceMatrix;
