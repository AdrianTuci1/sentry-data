import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopDock from './TopDock';
import Sidebar from './Sidebar';

const Layout = () => {
    const location = useLocation();
    // We assume specific routes (like /chat/:id) activate the "Session Mode"
    // For now, let's say the Home '/' is the default centered view, 
    // and '/chat' is the sidebar + floating chat + workspace view.

    // Actually, user wants "chat floats next to sidebar" even when starting?
    // User said: "cand incepem o sesiune chat chat-ul se muta langa sidebar si pluteste"
    // This implies transition from Home (Center) -> Session (Left).

    // User Request: "La ruta de modele putem renunta la sidebar"
    // User Update: "a ramas sidebar-ul pe pagina modelului, poti sa il scoti de acolo"
    // So we hide sidebar on ALL /models routes.
    const showSidebar = !location.pathname.startsWith('/models');

    return (
        <div className="flex h-screen w-full bg-[#131314] text-[#E3E3E3] overflow-hidden font-sans relative">

            {/* Top Dock Navigation */}
            <TopDock />

            {/* Main Container */}
            <div className="flex w-full h-full">

                {/* Static Sidebar (Left) - Hidden on Models Library */}
                {showSidebar && <Sidebar className="shrink-0" />}

                {/* Dynamic Content Area */}
                <main className="flex-1 relative h-full overflow-hidden">
                    <Outlet />
                </main>
            </div>

        </div>
    );
};

export default Layout;
