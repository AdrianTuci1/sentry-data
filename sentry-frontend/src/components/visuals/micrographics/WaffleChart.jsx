import React from 'react';

const WaffleChart = ({ data }) => {
    const totalSquares = 100;
    const value = data?.value || 68;
    const squares = Array.from({ length: totalSquares }, (_, i) => i < value);
    const renderColor = data?.colorTheme ? `var(--${data.colorTheme.replace('theme-', '')}-color, #34D399)` : '#34D399';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: '2px',
            width: '100%',
            height: '100%',
            padding: '5px'
        }}>
            {squares.map((active, i) => (
                <div key={i} style={{
                    backgroundColor: active ? renderColor : '#1F2937',
                    borderRadius: '1px',
                    transition: 'background-color 0.3s ease'
                }}></div>
            ))}
        </div>
    );
};

export default WaffleChart;
