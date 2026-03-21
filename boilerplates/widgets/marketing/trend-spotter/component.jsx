import React, { useMemo } from 'react';
import './TrendSpotter.css';

const TrendSpotter = ({ data }) => {
    // Reorder keywords so the highest weight is in the middle
    const orderedKeywords = useMemo(() => {
        const sourceData = (data.keywords?.length > 0 ? data.keywords : null) || 
                           (data.data?.length > 0 ? data.data : null) || 
                           (data.results?.length > 0 ? data.results : null) || [];
        
        if (!sourceData || sourceData.length === 0) return [
            { text: 'Innovation', weight: 100, trend: 'up' },
            { text: 'Sentry', weight: 85, trend: 'up' },
            { text: 'Market', weight: 70, trend: 'stable' },
            { text: 'Growth', weight: 65, trend: 'up' },
            { text: 'Legacy', weight: 40, trend: 'down' }
        ];
        const sorted = [...sourceData].sort((a, b) => (b.weight || 0) - (a.weight || 0));
        const result = [];
        sorted.forEach((kw, i) => {
            // Distribute items left and right alternately to create a bell-curve effect
            if (i % 2 === 0) {
                result.push(kw);
            } else {
                result.unshift(kw);
            }
        });
        return result;
    }, [data?.results, data?.data, data?.keywords]);

    return (
        <div className="trend-spotter-container">
            <div className="trend-cloud">
                {orderedKeywords.map((kw, index) => {
                    // Normalizing font size based on weight (assumed range 30-100)
                    const minWeight = 30;
                    const maxWeight = 100;
                    const minSize = 0.5; // Very small
                    const maxSize = 3.5; // Very large

                    const weightNormalized = Math.max(0, Math.min(1, (kw.weight - minWeight) / (maxWeight - minWeight)));
                    const fontSize = minSize + weightNormalized * (maxSize - minSize);

                    let trendClass = 'trend-stable';
                    if (kw.trend === 'up') trendClass = 'trend-up';
                    if (kw.trend === 'down') trendClass = 'trend-down';

                    return (
                        <div
                            key={index}
                            className={`cloud-word-wrapper ${trendClass}`}
                            style={{
                                fontSize: `${fontSize}rem`,
                                opacity: weightNormalized * 0.8 + 0.2
                            }}
                        >
                            <span className="cloud-word">
                                {kw.text}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TrendSpotter;
