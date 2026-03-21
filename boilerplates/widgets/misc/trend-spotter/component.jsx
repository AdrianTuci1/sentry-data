import React, { useMemo } from 'react';
import './style.css';

const TrendSpotter = ({ data = {}, isMock = false }) => {
    const defaultKeywords = [
        { text: 'AI Agents', weight: 95, trend: 'up' },
        { text: 'Analytics', weight: 80, trend: 'stable' },
        { text: 'Cloud', weight: 70, trend: 'stable' },
        { text: 'Legacy', weight: 40, trend: 'down' },
        { text: 'Data Lake', weight: 65, trend: 'up' },
        { text: 'Automation', weight: 88, trend: 'up' }
    ];

    const keywords = (Array.isArray(data.keywords) && data.keywords.length > 0 ? data.keywords : null) || 
                     (Array.isArray(data.data) && data.data.length > 0 && typeof data.data[0] === 'object' && "text" in data.data[0] ? data.data : null) || 
                     defaultKeywords;

    const orderedKeywords = useMemo(() => {
        if (!keywords) return [];
        const sorted = [...keywords].sort((a, b) => b.weight - a.weight);
        const result = [];
        sorted.forEach((kw, i) => {
            if (i % 2 === 0) {
                result.push(kw);
            } else {
                result.unshift(kw);
            }
        });
        return result;
    }, [keywords]);

    return (
        <div className="trend-spotter-container">
            <div className="trend-cloud">
                {orderedKeywords.map((kw, index) => {
                    const minWeight = 30;
                    const maxWeight = 100;
                    const minSize = 0.5;
                    const maxSize = 3.5;

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
            {/* Background Radar Scanner matching CSS logic */}
            <div className="trend-radar-scanner"></div>
        </div>
    );
};

export default TrendSpotter;
