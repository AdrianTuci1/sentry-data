import React from 'react';
import { Outlet } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import { AppShell } from '../app-shell';
import AnalyticsView from '../shell/AnalyticsView';
import NodesView from '../shell/NodesView';
import IntegrationsView from '../shell/IntegrationsView';
import ChatView from '../shell/ChatView';

const Layout = observer(() => {
    const { shellStore } = useStore();
    const activeSection = shellStore.activeSection;

    const renderContent = () => {
        switch (activeSection) {
            case 'analytics':
                return <AnalyticsView />;
            case 'nodes':
                return <NodesView />;
            case 'integrations':
                return <IntegrationsView />;
            case 'chat':
                return <ChatView />;
            default:
                return <NodesView />;
        }
    };

    return (
        <AppShell>
            <main className="flex-1 overflow-hidden bg-[#0B0D0E]">
                {renderContent()}
            </main>
        </AppShell>
    );
});

export default Layout;
