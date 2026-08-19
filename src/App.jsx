import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '@/components/ui/toaster';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import PageNotFound from '@/lib/PageNotFound';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AdminLayout from '@/components/AdminLayout';
import Login from '@/pages/Login';
import MealStation from '@/pages/MealStation';
import AdminEmployees from '@/pages/admin/AdminEmployees';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminDailyReport from '@/pages/admin/AdminDailyReport';
import AdminMonthlyReport from '@/pages/admin/AdminMonthlyReport';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminAdvancedSettings from '@/pages/admin/AdminAdvancedSettings';
import AdminUnidades from '@/pages/admin/AdminUnidades';
import AdminManualEntry from '@/pages/admin/AdminManualEntry';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
  </div>
);

/** Area administrativa: exige papel admin ou dono. */
const RequireAdmin = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, authError } = useAuth();

  if (isLoadingAuth) return <Spinner />;

  // Conta existe no Auth mas nao tem perfil na aplicacao.
  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* Estacao de refeicao: tela usada no totem, sem menu lateral */}
      <Route path="/" element={<MealStation />} />
      <Route path="/marmitas" element={<MealStation />} />

      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<AdminEmployees />} />
        <Route path="/admin/configuracoes" element={<AdminSettings />} />
        <Route path="/admin/relatorio-diario" element={<AdminDailyReport />} />
        <Route path="/admin/relatorio-mensal" element={<AdminMonthlyReport />} />
        <Route path="/admin/usuarios" element={<AdminUsers />} />
        <Route path="/admin/configuracoes-avancadas" element={<AdminAdvancedSettings />} />
        <Route path="/admin/unidades" element={<AdminUnidades />} />
        <Route path="/admin/lancamento-manual" element={<AdminManualEntry />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
