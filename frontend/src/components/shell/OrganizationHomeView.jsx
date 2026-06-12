import { Building2, Database, BarChart3, ShieldCheck } from 'lucide-react';
import { ViewFrame } from '@/components/shell/ViewFrame';
import { useAppStore } from '@/stores/useAppStore';
import '@/styles/organization-home.css';

function AccountTile({ label, value, detail, trend }) {
  return (
    <div className="organization-metric-tile">
      <span className="organization-metric-label">{label}</span>
      <div className="organization-metric-value-row">
        <span className="organization-metric-value">{value}</span>
        <span className="organization-metric-trend">{trend}</span>
      </div>
      <span className="organization-metric-detail">{detail}</span>
    </div>
  );
}

export function OrganizationHomeView() {
  const { organizations, workspaces } = useAppStore();
  const totalOrgs = organizations.length;
  const totalProjects = workspaces.length;
  const totalEvents = workspaces.reduce((sum, w) => {
    const num = parseFloat(w.monthlyEvents.replace(/[^0-9.]/g, ''));
    const multiplier = w.monthlyEvents.includes('K') ? 1000 : 1;
    return sum + (isNaN(num) ? 0 : num * multiplier);
  }, 0);
  const healthyProjects = workspaces.filter((w) => w.status === 'Healthy').length;
  const uniqueConnectors = [...new Set(workspaces.flatMap((w) => w.connectors || []))];

  return (
    <ViewFrame className="organization-home-frame" maxWidthClassName="max-w-7xl">
      <div className="organization-home-shell">
        <div className="organization-home-hero">
          <div>
            <span className="organization-home-kicker">Account home</span>
            <h1 className="organization-home-title">Overview</h1>
            <p className="organization-home-copy">
              Account-wide metrics across all organizations, projects, and connectors.
            </p>
          </div>
        </div>

        <div className="organization-home-grid">
          <section className="organization-panel organization-panel-span">
            <div className="organization-panel-header">
              <div className="organization-panel-title-row">
                <Building2 size={18} />
                <span>Account</span>
              </div>
            </div>
            <div className="organization-panel-split">
              <AccountTile
                label="Organizations"
                value={String(totalOrgs)}
                detail={`${organizations.filter((o) => o.plan !== 'Starter').length} on paid plans`}
                trend="+1 this quarter"
              />
              <AccountTile
                label="Projects"
                value={String(totalProjects)}
                detail={`${healthyProjects} healthy`}
                trend="+2 this month"
              />
            </div>
          </section>

          <section className="organization-panel organization-panel-span">
            <div className="organization-panel-header">
              <div className="organization-panel-title-row">
                <Database size={18} />
                <span>Usage</span>
              </div>
            </div>
            <div className="organization-panel-split">
              <AccountTile
                label="Total monthly events"
                value={totalEvents >= 1000 ? `${(totalEvents / 1000).toFixed(1)}K` : String(totalEvents)}
                detail="Across all projects"
                trend="+15.3%"
              />
              <AccountTile
                label="Active connectors"
                value={String(uniqueConnectors.length)}
                detail="Unique connector types deployed"
                trend="+3 this quarter"
              />
            </div>
          </section>

          <section className="organization-panel organization-panel-span">
            <div className="organization-panel-header">
              <div className="organization-panel-title-row">
                <BarChart3 size={18} />
                <span>Health</span>
              </div>
            </div>
            <div className="organization-panel-split">
              <AccountTile
                label="Healthy projects"
                value={`${Math.round((healthyProjects / totalProjects) * 100)}%`}
                detail={`${healthyProjects} of ${totalProjects} projects`}
                trend="Stable"
              />
              <AccountTile
                label="Data sources"
                value={String(uniqueConnectors.length * 2 + 3)}
                detail="Connected across all orgs"
                trend="+7.3%"
              />
            </div>
          </section>

          <section className="organization-card" style={{ gridColumn: 'span 2' }}>
            <div className="organization-card-header">
              <div className="organization-panel-title-row">
                <Building2 size={18} />
                <span>Organizations</span>
              </div>
            </div>
            <div className="organization-project-list">
              {organizations.map((org) => {
                const projectCount = workspaces.filter((w) => w.organizationId === org.id).length;
                return (
                  <div key={org.id} className="organization-project-row">
                    <div className="organization-project-main">
                      <div className="organization-project-dot" />
                      <div className="organization-project-copy">
                        <span className="organization-project-name">{org.name}</span>
                        <span className="organization-project-domain">{org.plan}</span>
                      </div>
                    </div>
                    <div className="organization-project-meta">
                      <span>{projectCount} projects</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="organization-card">
            <div className="organization-card-header">
              <div className="organization-panel-title-row">
                <ShieldCheck size={18} />
                <span>Recent activity</span>
              </div>
            </div>
            <div className="organization-activity-list">
              <div className="organization-activity-item">
                <span className="organization-activity-title">New project created</span>
                <span className="organization-activity-meta">Nexa workspace added to Nexa organization</span>
              </div>
              <div className="organization-activity-item">
                <span className="organization-activity-title">Connector enabled</span>
                <span className="organization-activity-meta">Stripe connected to 2 projects</span>
              </div>
              <div className="organization-activity-item">
                <span className="organization-activity-title">Organization created</span>
                <span className="organization-activity-meta">Octomus joined the account</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ViewFrame>
  );
}
