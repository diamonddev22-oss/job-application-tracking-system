import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function BrandMark() {
  return (
    <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">
        JA
      </span>
      <span>
        JATS<span className="text-brand-600">.</span>
      </span>
    </NavLink>
  );
}

export function Layout() {
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleRefreshStatus = async () => {
    setCheckingStatus(true);
    try {
      await refreshUser();
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <NavItem to="/extension">Get the extension</NavItem>
            {isAuthenticated ? (
              <>
                <NavItem to="/applications">Applications</NavItem>
                {user?.role === 'MANAGER' && <NavItem to="/manager">Manager Dashboard</NavItem>}
                <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
                <span className="hidden max-w-[10rem] truncate text-sm text-slate-500 sm:inline" title={user?.email}>
                  {user?.email}
                </span>
                <button type="button" onClick={logout} className="btn-secondary btn-sm ml-1">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login">Log in</NavItem>
                <NavLink to="/register" className="btn-primary btn-sm ml-1">
                  Register
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      {isAuthenticated && user && user.status !== 'ACTIVE' && (
        <div
          className={`border-b px-4 py-2.5 text-sm ${
            user.status === 'REJECTED'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  user.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
                }`}
              />
              {user.status === 'REJECTED'
                ? 'Your account request was rejected. Contact a manager if you believe this is a mistake.'
                : 'Your account is pending manager approval. Application tracking is disabled until approved.'}
            </span>
            {user.status === 'PENDING_APPROVAL' && (
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={checkingStatus}
                className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-60"
              >
                {checkingStatus ? 'Checking…' : 'Check again'}
              </button>
            )}
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        JATS — Job Application Tracking System
      </footer>
    </div>
  );
}
