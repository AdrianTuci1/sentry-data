import React from 'react';
import { ArrowRight, GitBranch, MoreVertical, Server } from 'lucide-react';

const statusMap = {
  healthy: { label: 'Healthy', className: 'healthy' },
  stable: { label: 'Stable', className: 'stable' },
  warning: { label: 'Warning', className: 'warning' },
  error: { label: 'Error', className: 'error' },
};

const cacheMap = {
  cached: { label: 'Cached', className: 'cached' },
  cold: { label: 'Cold', className: 'cold' },
  warm: { label: 'Warm', className: 'warm' },
};

export function ActiveDeploymentsWidget({ data }) {
  const { deployments = [] } = data;

  return (
    <section className="server-deployments-shell">
      <header className="server-deployments-header">
        <div className="server-deployments-title">
          <Server size={18} />
          <span>Active deployments</span>
        </div>

        <button type="button" className="server-deployments-viewall">
          <span>View all</span>
          <ArrowRight size={16} />
        </button>
      </header>

      <div className="server-deployments-body">
        <div className="server-deployments-table">
          {deployments.map((deployment, index) => {
            const status = statusMap[String(deployment.status || '').toLowerCase()] || {
              label: deployment.status,
              className: 'stable',
            };
            const cache = cacheMap[String(deployment.cache || '').toLowerCase()] || {
              label: deployment.cache,
              className: 'warm',
            };

            return (
              <article key={`${deployment.version}-${index}`} className="server-deployments-row">
                <div className="server-deployments-version">
                  <div className="server-deployments-version-name">{deployment.version}</div>
                  <div className="server-deployments-version-env">{deployment.environment}</div>
                </div>

                <div className={`server-deployments-badge ${status.className}`}>
                  <span className="server-deployments-badge-dot" />
                  <span>{status.label}</span>
                </div>

                <div className="server-deployments-branch">
                  <div className="server-deployments-branch-name">
                    <GitBranch size={18} />
                    <span>{deployment.branch}</span>
                  </div>
                  <div className="server-deployments-branch-meta">{deployment.commit}</div>
                </div>

                <div className="server-deployments-date">{deployment.date}</div>

                <div className={`server-deployments-cache ${cache.className}`}>
                  <span className="server-deployments-badge-dot" />
                  <span>{cache.label}</span>
                </div>

                <div className="server-deployments-actions">
                  <button
                    type="button"
                    className="server-deployments-menu"
                    aria-label={`More actions for ${deployment.version}`}
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
