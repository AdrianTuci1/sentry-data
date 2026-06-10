import React from 'react';
import { observer } from 'mobx-react-lite';
import ConnectorManager from '../connectors/ConnectorManager';

const IntegrationsView = observer(() => {
    return (
        <div className="h-full w-full bg-[#0B0D0E] overflow-auto p-6">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-semibold text-white mb-6">Integrations</h1>
                <ConnectorManager />
            </div>
        </div>
    );
});

export default IntegrationsView;
