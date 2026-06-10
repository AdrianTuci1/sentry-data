import React from 'react';
import { observer } from 'mobx-react-lite';
import Insights from '../visuals/Insights';

const AnalyticsView = observer(() => {
    return (
        <div className="h-full w-full bg-[#0B0D0E] overflow-auto">
            <Insights />
        </div>
    );
});

export default AnalyticsView;
