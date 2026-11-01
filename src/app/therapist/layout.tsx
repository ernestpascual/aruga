import React, { Suspense } from "react";
import { TherapistNav } from "@/components/layout/therapist-nav";

export default function TherapistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Suspense fallback={<div className="h-16 border-b border-zinc-800 bg-zinc-950" />}>
        <TherapistNav />
      </Suspense>
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">

        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
