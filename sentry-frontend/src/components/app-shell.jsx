import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }) {
    return (
        <SidebarProvider
            className={cn(
                "[--app-wrapper-max-width:100%]",
                "[--app-header-height:3rem]"
            )}
        >
            <AppSidebar />
            <SidebarInset className="bg-background flex flex-col min-h-screen">
                <AppHeader />
                <div className="flex-1 flex flex-col overflow-hidden">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
