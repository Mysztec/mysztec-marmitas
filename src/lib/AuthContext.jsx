import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { db } from '@/api/client';

/**
 * Estado de autenticacao da aplicacao.
 *
 * O Base44 fazia isso sozinho (token na URL, tela de login hospedada, checagem
 * de "usuario registrado"). Aqui a responsabilidade e nossa: a sessao vem do
 * Supabase Auth e o papel do usuario (`role`, `unidade_id`) vem da tabela
 * `profiles`. Sem perfil, a conta e tratada como nao cadastrada.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const me = await db.auth.me();
      setUser(me);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      // 401 = simplesmente nao logado; 403 = logado mas sem perfil na aplicacao.
      setAuthError(
        error.status === 403
          ? { type: 'user_not_registered', message: error.message }
          : null
      );
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    // Reage a login, logout e refresh de token feitos em qualquer aba.
    return db.auth.onChange((session) => {
      if (session) checkUserAuth();
      else {
        setUser(null);
        setAuthError(null);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });
  }, [checkUserAuth]);

  const signIn = useCallback(
    async (username, password) => {
      await db.auth.signIn(username, password);
      await checkUserAuth();
    },
    [checkUserAuth]
  );

  const logout = useCallback(async () => {
    await db.auth.logout();
    setUser(null);
    setAuthError(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoadingAuth,
    authChecked,
    authError,
    isAdmin: user?.role === 'admin' || user?.role === 'dono',
    isDono: user?.role === 'dono',
    signIn,
    logout,
    checkUserAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
