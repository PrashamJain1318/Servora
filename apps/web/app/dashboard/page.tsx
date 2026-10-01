import React from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">SERVORA Dashboard</h1>
            <p className="text-sm text-zinc-400">Phase 3 Authentication Verification</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
              ← Back to Home
            </Link>
            <UserButton />
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">Authenticated Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono uppercase">User Name</span>
              <p className="font-medium text-zinc-200 mt-1">
                {user
                  ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Anonymous'
                  : 'Not Loaded'}
              </p>
            </div>
            <div className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono uppercase">Primary Email</span>
              <p className="font-medium text-zinc-200 mt-1">
                {user?.emailAddresses?.[0]?.emailAddress ?? 'No email associated'}
              </p>
            </div>
            <div className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono uppercase">Clerk User ID</span>
              <p className="font-mono text-xs text-zinc-300 mt-1">{user?.id ?? 'N/A'}</p>
            </div>
            <div className="bg-zinc-950/80 p-4 rounded-lg border border-zinc-800">
              <span className="text-xs text-zinc-500 font-mono uppercase">
                Authentication Status
              </span>
              <p className="font-semibold text-emerald-400 mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Authenticated (Clerk Session Active)
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
