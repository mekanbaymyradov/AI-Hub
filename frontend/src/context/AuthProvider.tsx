import React, { useState, useEffect } from "react";
import { authApi } from "@/api/auth";
import { type UserPublic, type UserUpdate } from "@/api/types";
import { setAccessToken } from "@/api/axiosInstance";
import { AuthContext } from "@/context/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = () =>
    authApi
      .getCurrentUser()
      .then(setUser, () => setUser(null))
      .finally(() => setIsLoading(false));

  useEffect(() => {
    // The access token lives in memory, so a reload starts without one; the
    // 401 this gets is refreshed from the cookie by the API client.
    fetchUser();
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

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateUser, uploadAvatar, removeAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}
