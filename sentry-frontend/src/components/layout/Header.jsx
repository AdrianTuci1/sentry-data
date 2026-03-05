import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import {
    Settings,
    HelpCircle,
    Grid,
    ChevronsUpDown,
    Check,
    Plus,
    Key,
    Users,
    CreditCard,
    LogOut
} from 'lucide-react';
import './Header.css';

const Header = observer(() => {
    const navigate = useNavigate();

    // Access MobX Stores
    const { organizationStore, projectStore } = useStore();

    const currentOrg = organizationStore.currentOrg;
    const currentProject = projectStore.currentProject;
    const organizations = organizationStore.organizations;
    const projects = projectStore.projects;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const dropdownRef = useRef(null);
    const userMenuRef = useRef(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

    const handleOrgSelect = (org) => {
        organizationStore.selectOrg(org.id);
        navigate(`/`);
        setIsDropdownOpen(false);
    };

    const handleProjectSelect = (project) => {
        projectStore.selectProject(project.id);
        navigate(`/project/${project.id}`);
        setIsDropdownOpen(false);
    };

    return (
        <header className="app-header">
            {/* Left Section: Logo, Workspace Selector */}
            <div className="header-left">
                {/* Logo */}
                <div className="logo-container cursor-pointer" onClick={() => navigate('/')}>
                    <div className="h-6 w-6 rounded-md bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-[#131314] font-bold text-xs shadow-lg shadow-blue-500/20">
                        S
                    </div>
                </div>

                {/* Workspace Selector */}
                <div className="workspace-select-container" ref={dropdownRef}>
                    <div className="workspace-select" onClick={toggleDropdown}>
                        <span>/</span>
                        <span className="workspace-name">
                            {currentOrg ? currentOrg.name : 'Select Org'}
                            {currentProject && <span className="project-breadcrumb"> / {currentProject.name}</span>}
                        </span>
                        <ChevronsUpDown size={14} style={{ opacity: 0.5 }} />
                    </div>

                    {/* Workspace Dropdown */}
                    {isDropdownOpen && (
                        <div className="workspace-dropdown">
                            {/* Organizations Column */}
                            <div className="dropdown-column org-column">
                                <div className="column-header">Organisations</div>
                                <div className="column-list">
                                    {organizations.map(org => (
                                        <div
                                            key={org.id}
                                            className={`dropdown-item ${currentOrg?.id === org.id ? 'active' : ''}`}
                                            onClick={() => handleOrgSelect(org)}
                                        >
                                            <div className="org-avatar"></div>
                                            <span className="item-name">{org.name}</span>
                                            {currentOrg?.id === org.id && <Check size={14} className="check-icon" />}
                                        </div>
                                    ))}
                                </div>
                                <div className="column-footer">
                                    <button className="create-btn" onClick={() => { console.log('Create Org logic here'); setIsDropdownOpen(false); }}>
                                        <Plus size={14} />
                                        <span>Create Organisation</span>
                                    </button>
                                </div>
                            </div>

                            {/* Projects Column */}
                            <div className="dropdown-column project-column">
                                <div className="column-header">Projects</div>
                                <div className="column-list">
                                    {projects.length > 0 ? (
                                        projects.map(project => (
                                            <div
                                                key={project.id}
                                                className={`dropdown-item ${currentProject?.id === project.id ? 'active' : ''}`}
                                                onClick={() => handleProjectSelect(project)}
                                            >
                                                <div className="project-avatar"></div>
                                                <span className="item-name">{project.name}</span>
                                                {currentProject?.id === project.id && <Check size={14} className="check-icon" />}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">No projects found</div>
                                    )}
                                </div>
                                <div className="column-footer">
                                    <button className="create-btn" onClick={() => { console.log('Create Project logic here'); setIsDropdownOpen(false); }}>
                                        <Plus size={14} />
                                        <span>Create Project</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Section: Actions */}
            <div className="header-right">
                <ActionButton
                    icon={<Grid size={14} />}
                    label="Integrations"
                    onClick={() => console.log('Navigate Support')}
                />
                <ActionButton
                    icon={<HelpCircle size={14} />}
                    label="Support"
                    onClick={() => console.log('Navigate Support')}
                />

                {/* Avatar with Context Menu */}
                <div className="user-menu-container" ref={userMenuRef}>
                    <div className="user-avatar" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}></div>

                    {isUserMenuOpen && (
                        <div className="user-context-menu">
                            <div className="user-menu-header">
                                <span className="user-email-full">adrian.tucicovenco@gmail....</span>
                                <span className="user-email-sub">adrian.tucicovenco@gmail.com</span>
                            </div>

                            <div className="user-menu-section">
                                <button className="user-menu-item" onClick={() => setIsUserMenuOpen(false)}>
                                    <Key size={14} />
                                    <span>API Keys</span>
                                </button>
                                <button className="user-menu-item" onClick={() => setIsUserMenuOpen(false)}>
                                    <Settings size={14} />
                                    <span>Project Settings</span>
                                </button>
                                <button className="user-menu-item" onClick={() => setIsUserMenuOpen(false)}>
                                    <Users size={14} />
                                    <span>Organisation Settings</span>
                                </button>
                                <button className="user-menu-item" onClick={() => setIsUserMenuOpen(false)}>
                                    <CreditCard size={14} />
                                    <span>Billing</span>
                                </button>
                            </div>

                            <div className="user-menu-section logout">
                                <button className="user-menu-item logout-item">
                                    <LogOut size={14} />
                                    <span>Log out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
});

const ActionButton = ({ icon, label, onClick }) => (
    <button className="action-btn" onClick={onClick}>
        {icon}
        <span>{label}</span>
    </button>
);

export default Header;
