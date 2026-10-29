import React, { Suspense } from "react";
import { ClientNav } from "@/components/layout/client-nav";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Suspense fallback={<div className="h-16 border-b border-zinc-800 bg-zinc-950" />}>
        <ClientNav />
      </Suspense>
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6 max-w-5xl">
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
