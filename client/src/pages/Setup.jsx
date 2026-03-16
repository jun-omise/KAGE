/**
 * Setup page — wraps the existing SetupWizard component
 * for Phase 0 page structure compliance.
 */
import SetupWizard from '../components/SetupWizard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Setup() {
  const { checkAuth } = useAuth();

  return (
    <SetupWizard onComplete={() => checkAuth()} />
  );
}
