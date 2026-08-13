import { Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ApplicationsPage } from '../pages/ApplicationsPage';
import { ExtensionPage } from '../pages/ExtensionPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ManagerDashboardPage } from '../pages/ManagerDashboardPage';
import { ManagerUserDetailPage } from '../pages/ManagerUserDetailPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="extension" element={<ExtensionPage />} />

        <Route element={<ProtectedRoute allowedRoles={['USER']} />}>
          <Route path="applications" element={<ApplicationsPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['MANAGER']} />}>
          <Route path="manager" element={<ManagerDashboardPage />} />
          <Route path="manager/users/:userId" element={<ManagerUserDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
