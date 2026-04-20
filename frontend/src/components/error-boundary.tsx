"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route a caught React error to the right Sentry project.
 *
 * Inside the POS desktop app (Electron), `window.electronAPI.observability
 * .captureError` forwards the event to the POS-scoped `@sentry/electron/main`
 * SDK so pilot crashes show up in the POS dashboard with `process=renderer`.
 *
 * In the SaaS web build the bridge is undefined (`electronAPI` itself is
 * undefined) and we fall back to `@sentry/nextjs`, which is the pre-existing
 * behaviour and the right destination for SaaS users.
 *
 * Never throws — the capture path must not itself trigger another error.
 */
function reportComponentError(error: Error, componentStack: string | null | undefined): void {
  // Narrow type — we intentionally use optional chaining + typeof checks
  // instead of relying on a shared type import because this file is built
  // for both the SaaS bundle and the POS desktop renderer.
  const bridge =
    typeof window !== "undefined"
      ? (window as unknown as {
          electronAPI?: {
            observability?: {
              captureError?: (p: {
                message: string;
                stack?: string;
                source?: string;
              }) => Promise<void>;
            };
          };
        }).electronAPI?.observability?.captureError
      : undefined;

  if (bridge) {
    try {
      bridge({
        message: error.message || "React ErrorBoundary caught an error",
        stack: error.stack,
        source: "error-boundary",
      }).catch(() => {
        // IPC failed — silent drop (see hook doc for rationale).
      });
    } catch {
      // Defensive: never let the capture path itself throw.
    }
    return;
  }

  // SaaS fallback — same call shape as before, preserves the component
  // stack under `extra` for `@sentry/nextjs`'s default grouping.
  Sentry.captureException(error, {
    extra: { componentStack: componentStack ?? null },
  });
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
    reportComponentError(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-growth-red/30 bg-growth-red/5 p-8">
          <h2 className="text-lg font-semibold text-growth-red">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {process.env.NODE_ENV !== "production"
              ? this.state.error?.message || "An unexpected error occurred"
              : "An unexpected error occurred. Please try again."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-page hover:bg-accent/90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
