import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import SubjectSelector from './pages/SubjectSelector';
import Dashboard from './pages/Dashboard';
import ReviewPage from './pages/ReviewPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0a0f1e' } },
          error:   { iconTheme: { primary: '#f43f5e', secondary: '#0a0f1e' } },
        }}
      />
      <Routes>
        <Route path="/"                    element={<SubjectSelector />} />
        <Route path="/subject/:subjectId"  element={<Dashboard />} />
        <Route path="/review/:jobId"       element={<ReviewPage />} />
        <Route path="/results/:jobId"      element={<ResultsPage />} />
        <Route path="*"                    element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
