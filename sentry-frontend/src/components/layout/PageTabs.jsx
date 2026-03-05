import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import './PageTabs.css';

const PageTabs = observer(() => {
    const location = useLocation();
    const { projectStore } = useStore();
    const currentProject = projectStore.currentProject;

    // Determine context based on URL
    const isProjectView = location.pathname.startsWith('/project/');

    // Define tabs based on view
    const orgTabs = [
        { id: 'projects', label: 'Projects', path: '/' },
        { id: 'settings', label: 'Settings', path: '/settings' },
        { id: 'support', label: 'Support', path: '/support' }
    ];

    const projectTabs = [
        { id: 'engineering', label: 'Campaign Intelligence', path: `/project/${currentProject?.id}?tab=engineering` },
        { id: 'insights', label: 'Insights', path: `/project/${currentProject?.id}?tab=insights` },
        { id: 'settings', label: 'Settings', path: `/project/${currentProject?.id}/settings` }
    ];

    const activeTabs = isProjectView ? projectTabs : orgTabs;


    // Optional: Hide tabs if we don't have a valid route to show them for (e.g. invalid project ID)
    if (isProjectView && !currentProject) {
        return null;
    }

    return (
        <div className="page-tabs-container border-b border-[#2C2D2F] bg-[#18191A]">
            <nav className="page-tabs-nav flex gap-6 px-6">
                {activeTabs.map(tab => {
                    let isActive = false;

                    if (tab.path.includes('?')) {
                        const [pathBase, query] = tab.path.split('?');
                        // Exact match for base path + query param containing the tab ID
                        isActive = location.pathname === pathBase && location.search.includes(query);
                        // If we are at the base path with no query, highlight the first tab ('engineering')
                        if (location.pathname === pathBase && !location.search && tab.id === 'engineering') {
                            isActive = true;
                        }
                    } else {
                        isActive = location.pathname === tab.path ||
                            (tab.path !== '/' && location.pathname.startsWith(tab.path));
                    }

                    return (
                        <Link
                            key={tab.id}
                            to={tab.path}
                            className={`page-tab-link py-3 text-sm font-medium transition-colors border-b-2 relative top-[1px]
                                ${isActive
                                    ? 'text-[#E3E3E3] border-[#A8C7FA]'
                                    : 'text-[#80868B] border-transparent hover:text-[#C4C7C5]'
                                }
                            `}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
});

export default PageTabs;
