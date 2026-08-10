import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="text-lg font-semibold text-brand-700">
            JATS
          </NavLink>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/extension" className="text-slate-600 hover:text-brand-600">
              Get the extension
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/applications" className="text-slate-600 hover:text-brand-600">
                  Applications
                </NavLink>
                {user?.role === 'MANAGER' && (
                  <NavLink to="/manager" className="text-slate-600 hover:text-brand-600">
                    Manager Dashboard
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="text-slate-600 hover:text-brand-600">
                  Log in
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
                >
                  Register
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      {isAuthenticated && user && user.status !== 'ACTIVE' && (
        <div
          className={`border-b px-4 py-2 text-sm ${
            user.status === 'REJECTED'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span>
              {user.status === 'REJECTED'
                ? 'Your account request was rejected. Contact a manager if you believe this is a mistake.'
                : 'Your account is pending manager approval. Application tracking is disabled until approved.'}
            </span>
            {user.status === 'PENDING_APPROVAL' && (
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={checkingStatus}
                className="shrink-0 rounded-md bg-white px-2.5 py-1 font-medium text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-60"
              >
                {checkingStatus ? 'Checking…' : 'Check again'}
              </button>
            )}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
