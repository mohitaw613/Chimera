import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';
import { EvidencePage } from './pages/EvidencePage';
import { TimelinePage } from './pages/TimelinePage';
import { GraphPage } from './pages/GraphPage';
import { HypothesesPage } from './pages/HypothesesPage';
import { BlastRadiusPage } from './pages/BlastRadiusPage';
import { ReportPage } from './pages/ReportPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-cyber-950 text-slate-100">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/investigations/:id/upload" element={<UploadPage />} />
              <Route path="/investigations/:id/evidence" element={<EvidencePage />} />
              <Route path="/investigations/:id/timeline" element={<TimelinePage />} />
              <Route path="/investigations/:id/graph" element={<GraphPage />} />
              <Route path="/investigations/:id/hypotheses" element={<HypothesesPage />} />
              <Route path="/investigations/:id/blast-radius" element={<BlastRadiusPage />} />
              <Route path="/investigations/:id/report" element={<ReportPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
