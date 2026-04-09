import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowUp, BrainCircuit, BarChart2, ChevronDown, Mic, Plus, Sparkles, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import GlobalNav from './GlobalNav';
import RecommendationsMenu from './RecommendationsMenu';
import ProjectEditorOverlay from '../common/ProjectEditorOverlay';
import InviteMember from '../common/InviteMember';
import './FloatingNav.css';

const initialChatMessages = [
    {
        id: 'ai-1',
        role: 'AI system',
        tone: 'Live context',
        content: 'I can map connector drift, surface anomalies, or turn a noisy incident trail into a crisp action plan.',
        align: 'left'
    },
    {
        id: 'user-1',
        role: 'You',
        tone: 'Prompt',
        content: 'Show me what changed in the bottom area and keep the chat feeling open, not boxed in.',
        align: 'right'
    },
    {
        id: 'ai-2',
        role: 'AI system',
        tone: 'Direction',
        content: 'Done. The dock can expand into a composer while the chat above stays airy, editorial, and free of classic message bubbles.',
        align: 'left'
    }
];

const quickPrompts = [
    'Summarize connector anomalies for this view.',
    'Turn this page into a short incident brief.',
    'Suggest the next 3 actions for the team.'
];

const buildAiResponse = (prompt) => {
    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('connector')) {
        return 'I would start with connector health, recent sync gaps, and whether any source is silently drifting from the expected schema.';
    }

    if (normalizedPrompt.includes('incident') || normalizedPrompt.includes('error')) {
        return 'I would frame the signal in three beats: what changed, how wide the impact is, and which remediation step is most likely to reduce risk first.';
    }

    if (normalizedPrompt.includes('action') || normalizedPrompt.includes('next')) {
        return 'A good next move is to translate the signal into one owner, one hypothesis, and one measurable follow-up so momentum is obvious.';
    }

    return 'I can turn that into a compact brief, compare patterns across the workspace, or draft the next action path directly from what is on screen.';
};

const Layout = observer(() => {
    const navigate = useNavigate();
    const location = useLocation();
    const { dockStore, projectStore } = useStore();
    const [isHubOpen, setIsHubOpen] = useState(false);
    const [hubSection, setHubSection] = useState('nav');
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState(initialChatMessages);
    const chatInputRef = useRef(null);
    const threadRef = useRef(null);

    // Determine if we are inside a project (Workspace)
    const isProjectView = location.pathname.startsWith('/project/');
    const isSettingsView = location.pathname.startsWith('/settings');
    const projectId = isProjectView ? location.pathname.split('/')[2] : null;

    // Check query params to establish active tab context
    const queryParams = new URLSearchParams(location.search);
    const specificTab = queryParams.get('tab');

    // Engineering is the default when opening a project, Insights is the charts
    const isEngineering = isProjectView && (!specificTab || specificTab === 'engineering');
    const isInsights = isProjectView && specificTab === 'insights';
    const isSettingsTeam = isSettingsView && (!specificTab || specificTab === 'team');

    const handleTopRightClick = () => {
        if (isProjectView) {
            navigate('/');
        } else {
            setHubSection('nav');
            setIsHubOpen(true);
        }
    };

    const handleDockIconClick = () => {
        if (isProjectView && projectId) {
            if (isEngineering) {
                navigate(`/project/${projectId}?tab=insights`);
            } else {
                navigate(`/project/${projectId}?tab=engineering`);
            }
        }
    };

    const openConnectors = () => {
        setHubSection('connectors');
        setIsHubOpen(true);
    };

    const toggleRecommendations = () => {
        dockStore.toggleRecommendations();
    };

    const openCreateProject = () => {
        dockStore.openProjectEditor('create');
    };

    const openMemberInvite = () => {
        dockStore.openMemberInvite();
    };

    const closeProjectEditor = () => {
        dockStore.closeProjectEditor();
    };

    const closeMemberInvite = () => {
        dockStore.closeMemberInvite();
    };

    const handleProjectSubmit = (data) => {
        const { mode, project } = dockStore.projectEditor;

        if (mode === 'edit' && project) {
            projectStore.updateProject(project.id, data);
        } else {
            projectStore.addProject(data);
        }

        dockStore.closeProjectEditor();
    };

    const closeAiChat = () => {
        setIsAiChatOpen(false);
    };

    const handleAiChatToggle = () => {
        setIsAiChatOpen((currentState) => !currentState);
    };

    const handleQuickPrompt = (prompt) => {
        setIsAiChatOpen(true);
        setChatInput(prompt);
    };

    const handleChatSubmit = (event) => {
        event.preventDefault();

        const trimmedInput = chatInput.trim();
        if (!trimmedInput) {
            return;
        }

        const timestamp = Date.now();

        setChatMessages((currentMessages) => [
            ...currentMessages,
            {
                id: `user-${timestamp}`,
                role: 'You',
                tone: 'Prompt',
                content: trimmedInput,
                align: 'right'
            },
            {
                id: `ai-${timestamp + 1}`,
                role: 'AI system',
                tone: 'Live draft',
                content: buildAiResponse(trimmedInput),
                align: 'left'
            }
        ]);
        setChatInput('');
        setIsAiChatOpen(true);
    };

    useEffect(() => {
        if (!isAiChatOpen) {
            return undefined;
        }

        const frameId = window.requestAnimationFrame(() => {
            chatInputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [isAiChatOpen]);

    useEffect(() => {
        if (!isAiChatOpen || !threadRef.current) {
            return;
        }

        threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, [chatMessages, isAiChatOpen]);

    useEffect(() => {
        if (!isAiChatOpen) {
            return undefined;
        }

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsAiChatOpen(false);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isAiChatOpen]);

    useEffect(() => {
        setIsAiChatOpen(false);
    }, [location.pathname, location.search]);

    return (
        <div className="layout-wrapper">
            {/* Top Right Action Button */}
            <div className="floating-top-right">
                <button
                    className={`nav-circle-btn ${isHubOpen && !isProjectView ? 'menu-active' : ''}`}
                    onClick={handleTopRightClick}
                    aria-label={isProjectView ? "Go Back" : "Open Hub"}
                >
                    <ChevronDown size={20} strokeWidth={2.5} className={isHubOpen && !isProjectView ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                </button>
            </div>

            {/* Professional Global Hub */}
            <GlobalNav
                isOpen={isHubOpen}
                onClose={() => setIsHubOpen(false)}
                activeSection={hubSection}
            />

            {/* Recommendations Menu */}
            <RecommendationsMenu
                isOpen={dockStore.isRecommendationsOpen}
                onClose={() => dockStore.setRecommendationsOpen(false)}
            />

            <ProjectEditorOverlay
                isOpen={dockStore.projectEditor.isOpen}
                mode={dockStore.projectEditor.mode}
                project={dockStore.projectEditor.project}
                onClose={closeProjectEditor}
                onSubmit={handleProjectSubmit}
            />

            <InviteMember
                isOpen={dockStore.memberInvite.isOpen}
                onClose={closeMemberInvite}
            />

            {/* Dynamic Content Area */}
            <main className="layout-content">
                <Outlet />
            </main>

            {isAiChatOpen && (
                <section className="ai-chat-panel">
                    <div className="ai-chat-panel-glow" />

                    <div className="ai-chat-header">
                        <div>
                            <span className="ai-chat-kicker">AI Copilot</span>
                            <h2>Fluid workspace chat</h2>
                        </div>

                        <button
                            className="ai-chat-close-btn"
                            onClick={closeAiChat}
                            aria-label="Close AI chat"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="ai-chat-thread" ref={threadRef}>
                        <div className="ai-chat-intro">
                            <p>
                                Ask for summaries, next steps, or a sharper read on what is happening in the current workspace.
                            </p>
                        </div>

                        {chatMessages.map((message) => (
                            <article
                                key={message.id}
                                className={`ai-chat-line ai-chat-line-${message.align}`}
                            >
                                <div className="ai-chat-line-meta">
                                    <span>{message.role}</span>
                                    <span>{message.tone}</span>
                                </div>
                                <p>{message.content}</p>
                            </article>
                        ))}
                    </div>

                    <div className="ai-chat-prompts" aria-label="Suggested prompts">
                        {quickPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                className="ai-chat-prompt"
                                onClick={() => handleQuickPrompt(prompt)}
                                type="button"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Bottom Dock */}
            <div className="floating-bottom-dock">
                <div className={`dock-container ${isAiChatOpen ? 'chat-open' : ''}`}>
                    {/* Recommendations Toggle - Only in Insights view */}
                    {isInsights && (
                        <button
                            className={`dock-recommend-btn ${dockStore.isRecommendationsOpen ? 'active' : ''} ${isAiChatOpen ? 'dock-side-hidden' : ''}`}
                            onClick={toggleRecommendations}
                            aria-label="Toggle Recommendations"
                        >
                            <Sparkles size={18} />
                        </button>
                    )}

                    {/* Plus Button - Only in Intelligence/Engineering view */}
                    {isEngineering && (
                        <button
                            className={`dock-plus-btn ${isAiChatOpen ? 'dock-side-hidden' : ''}`}
                            onClick={openConnectors}
                            aria-label="Add Connector"
                        >
                            <Plus size={20} />
                        </button>
                    )}

                    {/* Create Project Button - Only in Home view */}
                    {!isProjectView && (
                        <button
                            className={`dock-create-btn ${isAiChatOpen ? 'dock-side-hidden' : ''}`}
                            aria-label={isSettingsTeam ? 'Add Member' : 'Create Project'}
                            onClick={isSettingsTeam ? openMemberInvite : openCreateProject}
                            type="button"
                        >
                            <Plus size={20} />
                        </button>
                    )}

                    <div className={`dock-composer-shell ${isAiChatOpen ? 'open' : ''}`}>
                        {!isAiChatOpen ? (
                            <button
                                className="dock-pill-btn"
                                aria-label="Open AI chat"
                                onClick={handleAiChatToggle}
                                type="button"
                            >
                                <div className="pill-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </button>
                        ) : (
                            <form
                                className="dock-chat-form"
                                onSubmit={handleChatSubmit}
                            >
                                <button
                                    className="dock-chat-close-btn"
                                    onClick={closeAiChat}
                                    aria-label="Close AI chat"
                                    type="button"
                                >
                                    <X size={16} />
                                </button>

                                <input
                                    ref={chatInputRef}
                                    className="dock-chat-input"
                                    type="text"
                                    value={chatInput}
                                    onChange={(event) => setChatInput(event.target.value)}
                                    placeholder="Ask the workspace something sharp..."
                                    aria-label="AI chat input"
                                />

                                <button className="dock-chat-mic-btn" type="button" aria-label="Voice input">
                                    <Mic size={16} />
                                </button>

                                <button
                                    className="dock-chat-send-btn"
                                    type="submit"
                                    aria-label="Send message"
                                    disabled={!chatInput.trim()}
                                >
                                    <ArrowUp size={16} />
                                </button>
                            </form>
                        )}
                    </div>

                    {isProjectView && (
                        <button
                            className={`dock-icon-btn ${isAiChatOpen ? 'dock-side-hidden' : ''}`}
                            onClick={handleDockIconClick}
                            aria-label="Toggle Context"
                        >
                            {isEngineering ? <BarChart2 size={20} /> : <BrainCircuit size={20} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export default Layout;
