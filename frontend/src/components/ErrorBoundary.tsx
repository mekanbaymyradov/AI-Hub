import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
// The instance, not the hook: a class component can't call hooks.
import i18n from "@/i18n";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Show a reload prompt instead of a blank screen when a child throws while rendering. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full w-full flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center"
      >
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-sm text-muted-foreground">{i18n.t("app.crashed")}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          {i18n.t("app.reload")}
        </Button>
      </div>
    );
  }
}
