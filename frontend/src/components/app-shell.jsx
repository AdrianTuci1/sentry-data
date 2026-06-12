import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import "@/styles/shell.css";

export function AppShell({ children }) {
  return (
    <SidebarProvider className="sidebar-provider-container">
      <AppSidebar />
      <SidebarInset className="app-main-layout">
        <AppHeader />
        <div className="app-content-wrapper">
          <div className="app-content-inner">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
