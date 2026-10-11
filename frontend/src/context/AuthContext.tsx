import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "@/api/auth";
import { type UserPublic, type UserUpdate } from "@/api/types";
import { getAccessToken, setAccessToken } from "@/api/axiosInstance";

interface AuthContextType {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UserUpdate) => Promise<UserPublic>;
  uploadAvatar: (file: File | Blob) => Promise<UserPublic>;
  removeAvatar: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    
    const initAuth = async () => {
      try {
        await fetchUser();
      } catch (error) {
        setIsLoading(false); 
      }
    };

    initAuth();
  }, []);

  const login = async (token: string) => {
    setAccessToken(token);
    await fetchUser();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const updateUser = async (data: UserUpdate): Promise<UserPublic> => {
    const updated = await authApi.updateCurrentUser(data);
    setUser(updated);
    return updated;
  };

  const uploadAvatar = async (file: File | Blob): Promise<UserPublic> => {
    const updated = await authApi.setAvatar(file);
    setUser(updated);
    return updated;
  };

  const removeAvatar = async (): Promise<void> => {
    await authApi.removeAvatar();
    await fetchUser();
  };

  const refetchUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateUser, uploadAvatar, removeAvatar, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
