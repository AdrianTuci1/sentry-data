import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import ChatSession from './pages/ChatSession';
import ModelDetail from './pages/ModelDetail';
import ModelsLibrary from './pages/ModelsLibrary';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="chat" element={<ChatSession />} />
          <Route path="models" element={<ModelsLibrary />} />
          <Route path="models/:id" element={<ModelDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
