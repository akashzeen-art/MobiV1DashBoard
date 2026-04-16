import { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');

  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTime');
    setLoggedIn(false);
  }

  return loggedIn
    ? <Dashboard onLogout={handleLogout} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}
