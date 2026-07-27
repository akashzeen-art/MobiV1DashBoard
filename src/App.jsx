import { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import ServicesPage from './ServicesPage';
import { prefetchReportsToday, clearReportsCache } from './utils';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    const ok = localStorage.getItem('isLoggedIn') === 'true';
    if (ok) prefetchReportsToday();
    return ok;
  });
  const [page, setPage] = useState('reports');
  const [servicesReady, setServicesReady] = useState(false);

  function handleLogin() {
    prefetchReportsToday();
    setLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTime');
    clearReportsCache();
    setLoggedIn(false);
    setPage('reports');
    setServicesReady(false);
  }

  function navigate(next) {
    if (next === 'services') setServicesReady(true);
    setPage(next);
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <div hidden={page !== 'reports'}>
        <Dashboard onLogout={handleLogout} onNavigate={navigate} />
      </div>
      {servicesReady && (
        <div hidden={page !== 'services'}>
          <ServicesPage onLogout={handleLogout} onNavigate={navigate} />
        </div>
      )}
    </>
  );
}
