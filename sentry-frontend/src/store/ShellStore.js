import { makeAutoObservable, runInAction } from "mobx";

export class ShellStore {
    rootStore = null;
    activeSection = 'nodes';
    isSidebarOpen = true;
    chatSessions = [];
    activeChatId = null;
    isChatPanelOpen = false;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
        this.loadPersistedState();
    }

    get sections() {
        return [
            { id: 'analytics', label: 'Analytics', icon: 'BarChart3' },
            { id: 'nodes', label: 'Nodes / Findings', icon: 'GitBranch' },
            { id: 'integrations', label: 'Integrations', icon: 'Plug' },
            { id: 'chat', label: 'Chat', icon: 'MessageSquare' },
        ];
    }

    get currentSection() {
        return this.sections.find(s => s.id === this.activeSection) || this.sections[0];
    }

    get currentWorkspace() {
        return this.rootStore?.organizationStore?.currentOrg || null;
    }

    get workspaces() {
        return this.rootStore?.organizationStore?.organizations || [];
    }

    get currentUser() {
        return this.rootStore?.organizationStore?.currentUser || null;
    }

    get activeChat() {
        return this.chatSessions.find(c => c.id === this.activeChatId) || null;
    }

    setActiveSection(sectionId) {
        this.activeSection = sectionId;
        this.persistState();
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        this.persistState();
    }

    setSidebarOpen(open) {
        this.isSidebarOpen = open;
        this.persistState();
    }

    async selectWorkspace(workspaceId) {
        if (this.rootStore?.organizationStore) {
            await this.rootStore.organizationStore.selectOrg(workspaceId);
        }
    }

    async createWorkspace(name) {
        if (this.rootStore?.organizationStore) {
            return await this.rootStore.organizationStore.createOrganization(name);
        }
        return null;
    }

    createChatSession(title = 'New Chat') {
        const session = {
            id: `chat_${Date.now()}`,
            title,
            messages: [],
            createdAt: new Date().toISOString(),
        };
        this.chatSessions.push(session);
        this.activeChatId = session.id;
        this.isChatPanelOpen = true;
        this.persistState();
        return session;
    }

    selectChat(chatId) {
        this.activeChatId = chatId;
        this.isChatPanelOpen = true;
        this.persistState();
    }

    closeChatPanel() {
        this.isChatPanelOpen = false;
        this.persistState();
    }

    openChatPanel() {
        this.isChatPanelOpen = true;
        if (!this.activeChatId && this.chatSessions.length === 0) {
            this.createChatSession();
        }
        this.persistState();
    }

    addMessageToChat(chatId, message) {
        const chat = this.chatSessions.find(c => c.id === chatId);
        if (chat) {
            chat.messages.push({
                id: `msg_${Date.now()}`,
                ...message,
                timestamp: new Date().toISOString(),
            });
            this.persistState();
        }
    }

    deleteChatSession(chatId) {
        this.chatSessions = this.chatSessions.filter(c => c.id !== chatId);
        if (this.activeChatId === chatId) {
            this.activeChatId = this.chatSessions.length > 0 ? this.chatSessions[0].id : null;
        }
        this.persistState();
    }

    persistState() {
        try {
            const state = {
                activeSection: this.activeSection,
                isSidebarOpen: this.isSidebarOpen,
                chatSessions: this.chatSessions,
                activeChatId: this.activeChatId,
                isChatPanelOpen: this.isChatPanelOpen,
            };
            localStorage.setItem('sentry_shell_state', JSON.stringify(state));
        } catch (e) {
            // ignore
        }
    }

    loadPersistedState() {
        try {
            const raw = localStorage.getItem('sentry_shell_state');
            if (raw) {
                const state = JSON.parse(raw);
                runInAction(() => {
                    if (state.activeSection) this.activeSection = state.activeSection;
                    if (typeof state.isSidebarOpen === 'boolean') this.isSidebarOpen = state.isSidebarOpen;
                    if (Array.isArray(state.chatSessions)) this.chatSessions = state.chatSessions;
                    if (state.activeChatId) this.activeChatId = state.activeChatId;
                    if (typeof state.isChatPanelOpen === 'boolean') this.isChatPanelOpen = state.isChatPanelOpen;
                });
            }
        } catch (e) {
            // ignore
        }
    }
}
