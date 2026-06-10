import {
    BarChart3,
    GitBranch,
    Plug,
    MessageSquare,
} from "lucide-react";

export const navGroups = [
    {
        label: "Workspace",
        items: [
            {
                title: "Analytics",
                path: "#/analytics",
                icon: <BarChart3 size={18} />,
                section: "analytics",
            },
            {
                title: "Nodes / Findings",
                path: "#/nodes",
                icon: <GitBranch size={18} />,
                section: "nodes",
            },
        ],
    },
    {
        label: "Connect",
        items: [
            {
                title: "Integrations",
                path: "#/integrations",
                icon: <Plug size={18} />,
                section: "integrations",
            },
            {
                title: "Chat",
                path: "#/chat",
                icon: <MessageSquare size={18} />,
                section: "chat",
            },
        ],
    },
];

export const navLinks = navGroups.flatMap((group) => group.items);
