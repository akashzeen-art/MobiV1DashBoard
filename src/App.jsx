import { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import ServicesPage from './ServicesPage';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [page, setPage] = useState('reports');

  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTime');
    setLoggedIn(false);
    setPage('reports');
  }

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  if (page === 'services') {
    return <ServicesPage onLogout={handleLogout} onNavigate={setPage} />;
  }

  return <Dashboard onLogout={handleLogout} onNavigate={setPage} />;
}
