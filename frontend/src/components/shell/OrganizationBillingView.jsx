import { useAppStore } from '@/stores/useAppStore';
import { ViewFrame } from '@/components/shell/ViewFrame';
import { CreditCard, Database, BarChart3, TrendingDown, ArrowUpRight } from 'lucide-react';
import '@/styles/organization-views.css';

export function OrganizationBillingView() {
  const { currentOrganization } = useAppStore();
  const org = currentOrganization || { name: '', plan: 'Starter', owner: '', slug: '' };

  return (
    <ViewFrame
      title="Billing"
      description="Track compute, orchestration, and managed warehouse costs across the whole organization."
      maxWidthClassName="max-w-5xl"
    >
      <div className="org-views-grid org-views-grid-2">
        <div className="org-stat-card">
          <div className="org-stat-card-row">
            <div className="org-stat-icon-box"><CreditCard size={18} /></div>
            <div>
              <div className="org-stat-label">Current Plan</div>
              <div className="org-stat-value">{org.plan}</div>
            </div>
          </div>
          <p className="org-stat-copy">{org.owner} &middot; Monthly billing</p>
        </div>

        <div className="org-stat-card">
          <div className="org-stat-card-row">
            <div className="org-stat-icon-box"><TrendingDown size={18} /></div>
            <div>
              <div className="org-stat-label">Projected Spend</div>
              <div className="org-stat-value">$2.4k</div>
            </div>
          </div>
          <p className="org-stat-copy">Current projected monthly infrastructure spend.</p>
        </div>
      </div>

      <div className="org-gap-4">
        <div className="org-views-grid org-views-grid-3">
          <div className="org-stat-compact">
            <div className="org-stat-compact-header">
              <Database size={14} />
              Warehouse
            </div>
            <div className="org-stat-compact-value">$1.1k</div>
            <div className="org-stat-compact-trend">
              <ArrowUpRight size={11} />
              +8.2% vs last month
            </div>
          </div>

          <div className="org-stat-compact">
            <div className="org-stat-compact-header">
              <BarChart3 size={14} />
              Compute
            </div>
            <div className="org-stat-compact-value">$890</div>
            <div className="org-stat-compact-trend">
              <ArrowUpRight size={11} />
              +3.5% vs last month
            </div>
          </div>

          <div className="org-stat-compact">
            <div className="org-stat-compact-header">
              <BarChart3 size={14} />
              Orchestration
            </div>
            <div className="org-stat-compact-value">$410</div>
            <div className="org-stat-compact-trend">
              <ArrowUpRight size={11} />
              +1.2% vs last month
            </div>
          </div>
        </div>
      </div>

      <div className="org-section-panel">
        <div className="org-section-header">
          <span className="org-section-title">Billing History</span>
        </div>
        {[
          { date: 'Jun 1, 2026', amount: '$2,410.00', status: 'Paid', invoice: 'INV-006' },
          { date: 'May 1, 2026', amount: '$2,185.00', status: 'Paid', invoice: 'INV-005' },
          { date: 'Apr 1, 2026', amount: '$1,980.00', status: 'Paid', invoice: 'INV-004' },
        ].map((entry) => (
          <div key={entry.invoice} className="org-row">
            <div className="org-row-left">
              <span className="org-row-name">{entry.date}</span>
              <span className="org-row-meta">{entry.invoice}</span>
            </div>
            <div className="org-row-right">
              <span className="org-row-name" style={{ fontSize: '14px' }}>{entry.amount}</span>
              <span className="org-status-paid">{entry.status}</span>
            </div>
          </div>
        ))}
      </div>
    </ViewFrame>
  );
}
