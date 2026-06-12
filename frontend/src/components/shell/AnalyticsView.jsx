import { useAppStore } from "@/stores/useAppStore";
import { DashboardLayout } from "@/components/widgets/DashboardLayout";
import { ViewFrame } from "@/components/shell/ViewFrame";
import { MarketingView } from "@/components/shell/MarketingView";
import { SalesView } from "@/components/shell/SalesView";
import { FinancialView } from "@/components/shell/FinancialView";
import { ProjectEmptyState, isProjectEmpty } from "@/components/shell/ProjectEmptyState";

const viewLayouts = {
  servers: "server-monitor",
  financial: "campaign-sales",
  sales: "campaign-sales",
  marketing: "marketing-performance",
  web: "analytics",
};

export function AnalyticsView() {
  const { activeAnalyticsView, currentWorkspace } = useAppStore();
  const layoutId = viewLayouts[activeAnalyticsView] || "server-monitor";
  const shouldShowEmptyState = isProjectEmpty(currentWorkspace);

  return (
    <ViewFrame>
      {shouldShowEmptyState ? (
        <ProjectEmptyState mode="analytics" />
      ) : activeAnalyticsView === "marketing" ? (
        <MarketingView />
      ) : activeAnalyticsView === "sales" ? (
        <SalesView />
      ) : activeAnalyticsView === "financial" ? (
        <FinancialView />
      ) : (
        <DashboardLayout layoutId={layoutId} isNested={false} />
      )}
    </ViewFrame>
  );
}
