import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Job Application Tracking System</h1>
      <p className="text-slate-600">
        {isAuthenticated
          ? `Welcome back${user ? `, ${user.email}` : ''}.`
          : 'Log in or register to start tracking your job applications.'}
      </p>

      {isAuthenticated ? (
        <div className="mt-6 flex gap-3">
          <Link
            to="/applications"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View applications
          </Link>
          <Link
            to="/extension"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Get the Chrome extension
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex gap-3">
          <Link
            to="/register"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log in
          </Link>
        </div>
      )}

      <p className="mt-8 text-sm text-slate-500">
        Install the{' '}
        <Link to="/extension" className="font-medium text-brand-600 hover:underline">
          Chrome extension
        </Link>{' '}
        to automatically track applications as you apply on job boards — they'll show up in your
        application history without any manual entry.
      </p>
    </div>
  );
}
