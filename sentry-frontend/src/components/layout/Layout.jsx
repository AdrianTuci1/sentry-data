import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import PageTabs from './PageTabs';

const Layout = () => {
    return (
        <div className="flex flex-col h-screen w-full bg-[#131314] text-[#E3E3E3] overflow-hidden font-sans relative">
            <Header />
            <PageTabs />
            {/* Dynamic Content Area */}
            <main className="flex-1 overflow-auto relative h-full">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
