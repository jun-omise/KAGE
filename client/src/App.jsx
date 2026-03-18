import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import MainLayout from './components/layout/MainLayout.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { loading, authenticated, setupComplete } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-kage-bg">
        <Loader2 size={24} className="animate-spin text-kage-primary" />
      </div>
    );
  }

  if (!setupComplete) return <Setup />;
  if (!authenticated) return <Login />;
  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
