import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sentryCapture = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (err: unknown, ctx?: unknown) => sentryCapture(err, ctx),
}));

import { ErrorBoundary } from "@/components/error-boundary";

function ProblemChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error("Test error message");
  return <div>No error</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console errors in test output
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("shows Try again button that resets error state", async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // After clicking Try again, error state resets (but child still throws)
    await user.click(screen.getByText("Try again"));
    // It will catch the error again
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows generic message when error has no message", () => {
    function ThrowEmpty(): never {
      throw new Error();
    }
    render(
      <ErrorBoundary>
        <ThrowEmpty />
      </ErrorBoundary>,
    );
    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
  });
});

describe("ErrorBoundary — crash-reporting routing", () => {
  const originalError = console.error;
  const bridgeCapture = vi.fn();
  const originalElectronAPI = (window as unknown as { electronAPI?: unknown }).electronAPI;

  beforeEach(() => {
    console.error = vi.fn();
    bridgeCapture.mockReset();
    sentryCapture.mockReset();
  });
  afterEach(() => {
    console.error = originalError;
    (window as unknown as { electronAPI?: unknown }).electronAPI = originalElectronAPI;
  });

  function installBridge(): void {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      app: { isElectron: true, platform: "win32" },
      observability: {
        captureError: (p: unknown) => {
          bridgeCapture(p);
          return Promise.resolve();
        },
      },
    };
  }

  function removeBridge(): void {
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  }

  it("routes through the POS IPC bridge when it is available (Electron)", () => {
    installBridge();
    function Boom(): never {
      throw new Error("component boom");
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(bridgeCapture).toHaveBeenCalledTimes(1);
    expect(bridgeCapture.mock.calls[0][0]).toMatchObject({
      message: "component boom",
      source: "error-boundary",
    });
    expect(typeof bridgeCapture.mock.calls[0][0].stack).toBe("string");
    // SaaS Sentry is NOT invoked when the POS bridge is available.
    expect(sentryCapture).not.toHaveBeenCalled();
  });

  it("falls back to @sentry/nextjs when the bridge is absent (SaaS)", () => {
    removeBridge();
    function Boom(): never {
      throw new Error("saas boom");
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    const [err, ctx] = sentryCapture.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("saas boom");
    expect(ctx).toHaveProperty("extra");
    expect(bridgeCapture).not.toHaveBeenCalled();
  });

  it("falls back to @sentry/nextjs when the bridge exists but .observability is missing", () => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      app: { isElectron: true, platform: "win32" },
      // no observability — e.g. POS build earlier than #499
    };
    function Boom(): never {
      throw new Error("legacy pos");
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    expect(bridgeCapture).not.toHaveBeenCalled();
  });

  it("never throws when the bridge rejects the IPC call", () => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
      app: { isElectron: true, platform: "win32" },
      observability: {
        captureError: () => Promise.reject(new Error("ipc down")),
      },
    };
    function Boom(): never {
      throw new Error("boom");
    }
    // Rendering must NOT rethrow despite the IPC rejection.
    expect(() =>
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
    // Fallback Sentry is not invoked when the bridge accepted the call
    // (it just rejected asynchronously — that's a silent-drop scenario).
    expect(sentryCapture).not.toHaveBeenCalled();
  });
});
