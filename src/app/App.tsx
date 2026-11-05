import { HashRouter } from 'react-router-dom';
import AuthProvider from '../contexts/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import FirebaseSetup from '../pages/FirebaseSetup';
import SignIn from '../pages/SignIn';
import AppRoutes from './routes';
import { useAuth } from '../contexts/AuthContext';

function AppContent() {
  const { authError, configured, loading, user } = useAuth();

  if (!configured) {
    return (
      <AppLayout>
        <FirebaseSetup />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-state" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Checking your sign-in status...</span>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="app-content">
          {authError && <div className="alert alert-danger w-100" role="alert">{authError}</div>}
          <SignIn />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="app-content">
        {authError && <div className="alert alert-danger w-100" role="alert">{authError}</div>}
        <AppRoutes />
      </div>
    </AppLayout>
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
