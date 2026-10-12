import { createContext, useContext } from "react";
import { type UserPublic, type UserUpdate } from "@/api/types";

interface AuthContextType {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UserUpdate) => Promise<UserPublic>;
  uploadAvatar: (file: File | Blob) => Promise<UserPublic>;
  removeAvatar: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
