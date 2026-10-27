import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Per spec: store JWT strictly in memory (React Context state)
  const applyToken = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    setAuthToken(newToken);
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password });
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (tempToken, otp) => {
    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp({ tempToken, otp });
      if (res.token && res.user) {
        applyToken(res.token, res.user);
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, password, role) => {
    setIsLoading(true);
    try {
      const res = await authApi.register({ name, email, password, role });
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isAdmin: user?.role === 'admin',
      isAnalyst: user?.role === 'analyst' || user?.role === 'admin',
      isLoading,
      login,
      verifyOtp,
      register,
      logout,
      applyToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
