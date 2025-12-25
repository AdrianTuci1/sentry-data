import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ProjectDashboard from './pages/ProjectDashboard';
import ModelDetail from './pages/ModelDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="project/:projectId" element={<ProjectDashboard />} />
          <Route path="models/:id" element={<ModelDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
