import { useState, useEffect, useRef } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

const INACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const timerRef = useRef(null);

  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTime');
    setLoggedIn(false);
  }

  function resetTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleLogout();
      alert('You have been logged out due to inactivity.');
    }, INACTIVE_TIMEOUT);
  }

  useEffect(() => {
    if (!loggedIn) return;
    resetTimer();
    EVENTS.forEach(e => window.addEventListener(e, resetTimer));
    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [loggedIn]);

  return loggedIn
    ? <Dashboard onLogout={handleLogout} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}
