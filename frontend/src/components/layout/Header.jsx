import { Bell, PanelLeft, Search } from 'lucide-react';
import { findSectionById } from '@/components/app-shared';
import { useAppStore } from '@/stores/useAppStore';

export function Header() {
  const {
    activeScope,
    activeSection,
    currentOrganization,
    currentWorkspace,
    sidebarCollapsed,
    toggleSidebar,
  } = useAppStore();

  const section = findSectionById(activeScope, activeSection);
  const scopeLabel = activeScope === 'organization' ? currentOrganization.name : currentWorkspace.name;

  return (
    <header className="h-12 border-b border-border bg-bg-secondary flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {sidebarCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted transition-colors"
          >
            <PanelLeft size={18} />
          </button>
        ) : null}

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {activeScope === 'organization' ? 'Organization' : 'Project'}
          </div>
          <h1 className="text-sm font-medium text-text-primary truncate">
            {scopeLabel} · {section?.title || 'Dashboard'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-md hover:bg-bg-hover text-text-muted transition-colors">
          <Search size={16} />
        </button>
        <button className="p-2 rounded-md hover:bg-bg-hover text-text-muted transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
        </button>
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center ml-1">
          <span className="text-xs font-medium text-accent">A</span>
        </div>
      </div>
    </header>
  );
}
