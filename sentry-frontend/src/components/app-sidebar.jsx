"use client";

import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/StoreProvider";
import { navGroups } from "@/components/app-shared";
import { CustomTrigger } from "@/components/custom-trigger";
import { NavUser } from "@/components/nav-user";
import {
    ChevronDown,
    Plus,
    Settings,
} from "lucide-react";

export const AppSidebar = observer(() => {
    const { shellStore } = useStore();
    const currentWorkspace = shellStore.currentWorkspace;
    const workspaces = shellStore.workspaces;
    const activeSection = shellStore.activeSection;

    const handleSectionClick = (sectionId) => {
        shellStore.setActiveSection(sectionId);
    };

    const handleWorkspaceSelect = (workspaceId) => {
        shellStore.selectWorkspace(workspaceId);
    };

    const handleCreateWorkspace = () => {
        const name = prompt("Enter workspace name:");
        if (name?.trim()) {
            shellStore.createWorkspace(name.trim());
        }
    };

    return (
        <Sidebar
            className={cn(
                "*:data-[slot=sidebar-inner]:bg-background",
                "transition-[left,right,top,width]"
            )}
            collapsible="icon"
            variant="sidebar"
        >
            <SidebarHeader className="h-(--app-header-height,3rem) flex-row items-center justify-between px-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full justify-between gap-2 px-2 font-medium"
                        >
                            <span className="truncate">
                                {currentWorkspace?.name || "Workspace"}
                            </span>
                            <ChevronDown size={14} className="shrink-0 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {workspaces.map((ws) => (
                            <DropdownMenuItem
                                key={ws.id}
                                onClick={() => handleWorkspaceSelect(ws.id)}
                                className={cn(
                                    "cursor-pointer",
                                    ws.id === currentWorkspace?.id && "bg-accent"
                                )}
                            >
                                <span className="truncate">{ws.name}</span>
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleCreateWorkspace}
                            className="cursor-pointer"
                        >
                            <Plus size={14} className="mr-2" />
                            New Workspace
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <CustomTrigger place="sidebar" />
            </SidebarHeader>

            <SidebarContent>
                {navGroups.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                            {group.label}
                        </SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.section}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activeSection === item.section}
                                        tooltip={item.title}
                                        onClick={() => handleSectionClick(item.section)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.icon}
                                            <span>{item.title}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter className="px-3 py-2">
                <div className="flex items-center justify-between">
                    <NavUser />
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                    >
                        <a aria-label="Settings" href="#/settings">
                            <Settings size={16} />
                        </a>
                    </Button>
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
});
