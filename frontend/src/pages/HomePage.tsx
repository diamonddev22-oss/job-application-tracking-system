import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    title: 'Automatic tracking',
    description:
      "Apply anywhere on the web — the Chrome extension detects a successful submission and records it for you. No manual data entry.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
  },
  {
    title: 'Screenshot proof',
    description:
      'Every tracked application is captured with a screenshot of the confirmation page, so you always have proof of what you submitted and when.',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 0 1 2-2h.5l1-1.5h11l1 1.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: 'Full status history',
    description:
      'Follow every application from applied to screening, interview, offer, or rejection — with a complete timeline of every status change.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
];

export function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 via-white to-white px-6 py-14 text-center shadow-sm sm:px-12">
        <span className="badge mx-auto bg-brand-100 text-brand-700">Track every application, automatically</span>
        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Job Application Tracking System
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          {isAuthenticated
            ? `Welcome back${user ? `, ${user.email}` : ''}. Here's where your application history lives.`
            : 'Log in or register to start tracking your job applications — no spreadsheets required.'}
        </p>

        {isAuthenticated ? (
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/applications" className="btn-primary">
              View applications
            </Link>
            <Link to="/extension" className="btn-secondary">
              Get the Chrome extension
            </Link>
          </div>
        ) : (
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary">
              Get started
            </Link>
            <Link to="/login" className="btn-secondary">
              Log in
            </Link>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-5 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                {feature.icon}
              </svg>
            </span>
            <h2 className="mt-3 font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
          </div>
        ))}
      </section>

      <p className="mt-8 text-center text-sm text-slate-500">
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
