import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthProvider";
import { useAuth } from "@/context/auth";
import { ThemeProvider } from "@/context/ThemeProvider";
import { Auth } from "@/components/Auth";
import Chat  from "@/pages/Chat";
import Landing from "@/pages/Landing";

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Routes>
        <Route
          path="/"
          element={isAuthenticated ? <Chat /> : <Landing />}
        />
        <Route
          path="/chats/:chatId"
          element={isAuthenticated ? <Chat /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />}
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
