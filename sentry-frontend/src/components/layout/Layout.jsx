import React from 'react';
import { Outlet } from 'react-router-dom';

const Layout = () => {
    return (
        <div className="flex h-screen w-full bg-[#131314] text-[#E3E3E3] overflow-hidden font-sans relative">
            {/* Main Container - No Sidebar, No TopDock */}
            <div className="flex w-full h-full">
                {/* Dynamic Content Area */}
                <main className="flex-1 relative h-full overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
