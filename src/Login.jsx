import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (email === 'admin@gmail.com' && password === 'Admin@123') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('loginTime', new Date().toISOString());
      onLogin();
    } else {
      setError('Invalid email or password. Please try again.');
      setPassword('');
    }
  }

  return (
    <div className="login-body">
      <div className="login-box">
        <h1 className="login-title">📊 V1 Mobi Dashboard</h1>
        <h2 className="login-subtitle">Login to Continue</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password" required autoComplete="current-password" />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="login-button">Login</button>
        </form>
      </div>
    </div>
  );
}
