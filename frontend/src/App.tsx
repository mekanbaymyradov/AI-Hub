import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthProvider";
import { useAuth } from "@/context/auth";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Split per page, so signed-in users don't download the landing page's three.js scene.
const Auth = lazy(() => import("@/components/Auth").then((m) => ({ default: m.Auth })));
const Chat = lazy(() => import("@/pages/Chat"));
const Landing = lazy(() => import("@/pages/Landing"));

const loadingScreen = (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <p className="text-muted-foreground animate-pulse">Loading...</p>
  </div>
);

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return loadingScreen;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <ErrorBoundary>
        <Suspense fallback={loadingScreen}>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
