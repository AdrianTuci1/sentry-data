import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store/StoreProvider';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ProjectDashboard from './pages/ProjectDashboard';
import Settings from './pages/Settings';
import Support from './pages/Support';
import InvitationAcceptPage from './pages/InvitationAcceptPage';
import SharedProjectPage from './pages/SharedProjectPage';

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/join/:tenantId/:workspaceId/:inviteToken" element={<InvitationAcceptPage />} />
          <Route path="/shared/:tenantId/:projectId/:shareToken" element={<SharedProjectPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="project/:projectId" element={<ProjectDashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="support" element={<Support />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
