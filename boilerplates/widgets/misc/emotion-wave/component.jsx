import React from 'react';
import './style.css';

const EmotionWave = ({ data = {}, isMock = false }) => {
    const score = data.sentimentScore ?? data.data?.sentimentScore ?? data.value ?? 50;
    
    let state = 'neutral';
    let emoji = '😐';

    if (score >= 70) {
        state = 'positive';
        emoji = '😊';
    } else if (score <= 35) {
        state = 'crisis';
        emoji = '⚠️';
    }

    const displayEmoji = data.emoji ?? data.data?.emoji ?? emoji;

    return (
        <div className={`emotion-wave-container ${state}`}>
            <div className="wave-circle">
                <div className="wave-layer wave-1" style={{ top: `${100 - score}%` }}></div>
                <div className="wave-layer wave-2" style={{ top: `${100 - score}%` }}></div>
                <div className="wave-layer wave-3" style={{ top: `${100 - score}%` }}></div>

                <div className="emoji-overlay">
                    <span className="sentiment-emoji">{displayEmoji}</span>
                </div>
            </div>
            <div className="sentiment-info">
                <span className="sentiment-label">{state.charAt(0).toUpperCase() + state.slice(1)}</span>
                <span className="sentiment-score">{score}%</span>
            </div>
        </div>
    );
};

export default EmotionWave;
