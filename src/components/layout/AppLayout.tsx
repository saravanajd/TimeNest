import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type AppLayoutProps = {
  children: ReactNode;
};

const navigationItems = [
  { to: '/', label: 'Daily Timesheet', icon: 'bi-calendar2-check', end: true },
  { to: '/weekly', label: 'Weekly View', icon: 'bi-calendar-week', end: false },
  { to: '/monthly', label: 'Monthly Report', icon: 'bi-bar-chart-line', end: false },
  { to: '/settings', label: 'Settings', icon: 'bi-gear', end: false },
];

function AppLayout({ children }: AppLayoutProps) {
  const { configured, signOutUser, user } = useAuth();
  const [signOutError, setSignOutError] = useState('');

  async function handleSignOut() {
    setSignOutError('');
    try {
      await signOutUser();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container">
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3 py-3">
            <NavLink to="/" end className="brand-link" aria-label="TimeNest home">
              <span className="brand-mark" aria-hidden="true">
                <i className="bi bi-hourglass-split" />
              </span>
              <span>
                <span className="brand-name">TimeNest</span>
                <span className="brand-caption">Your work, in good time</span>
              </span>
            </NavLink>

            {configured && user && (
              <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                <nav aria-label="Main navigation">
                  <ul className="nav app-nav flex-wrap">
                    {navigationItems.map(({ to, label, icon, end }) => (
                      <li className="nav-item" key={to}>
                        <NavLink
                          to={to}
                          end={end}
                          className={({ isActive }) =>
                            `nav-link app-nav__link${isActive ? ' active' : ''}`
                          }
                        >
                          <i className={`bi ${icon}`} aria-hidden="true" />
                          <span>{label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="account-controls">
                  <span className="account-email" title={user.email ?? undefined}>{user.email}</span>
                  <button className="btn btn-outline-secondary btn-sm" onClick={handleSignOut} type="button">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
          {signOutError && <p className="alert alert-danger py-2 mb-3" role="alert">{signOutError}</p>}
        </div>
      </header>

      <main className="container app-main">{children}</main>

      <footer className="app-footer">
        <div className="container">A calmer way to keep track of your work.</div>
      </footer>
    </div>
  );
}

export default AppLayout;
