import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginRequest } from '../api/auth';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => loginRequest(email, password),
    onSuccess: (auth) => {
      login(auth);
      // Managers review applicants, not their own tracked applications — that page (and its nav
      // link, see Layout) is USER-only, so route them straight to the dashboard instead.
      navigate(auth.role === 'MANAGER' ? '/manager' : '/applications', { replace: true });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.reset();
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm">
          JA
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to review your tracked applications.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
            />
          </div>

          {mutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {getErrorMessage(mutation.error, 'Login failed')}
            </p>
          )}

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        {"Don't have an account? "}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
