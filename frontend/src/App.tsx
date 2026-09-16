import { useEffect, useState } from 'react';
import { Landing } from './pages/Landing';
import { AppShell } from './pages/AppShell';
import type { AuthResponse, User } from './types';
import { api, setToken } from './lib/api';
import './styles.css';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('wave_token');
    if (!token) {
      setChecking(false);
      return;
    }
    setToken(token);
    api.me()
      .then((me) => {
        localStorage.setItem('wave_user', JSON.stringify(me));
        setUser(me);
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('wave_user');
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const auth = (response: AuthResponse) => {
    setToken(response.access_token);
    localStorage.setItem('wave_user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('wave_user');
    setUser(null);
  };

  if (checking) return <div className="boot-screen"><div className="boot-logo">W</div><span>Loading Wave…</span></div>;
  return user ? <AppShell initialUser={user} onLogout={logout} /> : <Landing onAuth={auth} />;
}
