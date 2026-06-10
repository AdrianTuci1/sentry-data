import { observer } from "mobx-react-lite";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/store/StoreProvider";
import { CustomTrigger } from "@/components/custom-trigger";
import { NavUser } from "@/components/nav-user";

export const AppHeader = observer(() => {
    const { shellStore } = useStore();
    const section = shellStore.currentSection;

    return (
        <header
            className="sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-4 md:px-6"
        >
            <div className="flex items-center gap-3">
                <CustomTrigger place="navbar" />
                <Separator
                    className="h-4 data-[orientation=vertical]:self-center"
                    orientation="vertical"
                />
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbPage>{section?.label || "Dashboard"}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            <div className="flex items-center gap-3">
                <NavUser />
            </div>
        </header>
    );
});
