import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h1 className="mb-2 text-2xl font-semibold">404 - Page not found</h1>
      <Link to="/" className="text-brand-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
