"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAIAnomalies } from "@/hooks/use-ai-anomalies";

function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useAIAnomalies();
  const anomalyCount = data?.anomalies?.length ?? 0;

  return (
    <>
      <Sidebar anomalyCount={anomalyCount} />
      <main className="min-h-screen p-4 pt-18 lg:ml-60 lg:p-6 lg:pt-6">
        {children}
      </main>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ErrorBoundary>
        <AppShell>{children}</AppShell>
      </ErrorBoundary>
    </Providers>
  );
}
