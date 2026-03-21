import React from 'react';
import ReactECharts from 'echarts-for-react';
import './style.css';

const IntentSunburst = ({ data = {} }) => {
    const sunburstData = (data.sunburstData?.length > 0 ? data.sunburstData : null) || 
                         (data.data?.length > 0 ? data.data : null) || 
                         (data.results?.length > 0 ? data.results : null) || [
                             {
                                 name: 'Ready to Buy',
                                 itemStyle: { color: '#10B981' },
                                 children: [
                                     { name: 'Product A', value: 15 },
                                     { name: 'Product B', value: 10 },
                                     { name: 'Checkout', value: 25 }
                                 ]
                             },
                             {
                                 name: 'Researching',
                                 itemStyle: { color: '#3B82F6' },
                                 children: [
                                     {
                                         name: 'Pricing',
                                         children: [
                                             { name: 'Pro', value: 10 },
                                             { name: 'Ent', value: 5 }
                                         ]
                                     },
                                     { name: 'Features', value: 15 }
                                 ]
                             },
                             {
                                 name: 'Accidental',
                                 itemStyle: { color: '#6B7280' },
                                 children: [
                                     { name: 'Bounce', value: 10 },
                                     { name: 'Misclick', value: 5 }
                                 ]
                             }
                         ];

    const option = {
        series: {
            type: 'sunburst',
            data: sunburstData,
            radius: ['15%', '90%'],
            itemStyle: {
                borderRadius: 5,
                borderWidth: 2,
                borderColor: '#111827'
            },
            label: {
                rotate: 'radial',
                fontSize: 9,
                color: '#fff'
            },
            emphasis: {
                focus: 'ancestor'
            }
        },
        animationDuration: 1500
    };

    return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

export default IntentSunburst;
