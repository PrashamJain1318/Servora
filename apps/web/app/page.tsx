'use client';

import React from 'react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@servora/ui';
import { APP_CONFIG } from '@servora/config';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-center">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-wider">
          Phase 3 Authentication • Active
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
          {APP_CONFIG.name}
        </h1>

        <p className="text-xl sm:text-2xl text-zinc-400 font-medium italic">
          &ldquo;{APP_CONFIG.tagline}&rdquo;
        </p>

        <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
          The AI-powered growth and operations platform for appointment-based service businesses.
          Clerk authentication and multi-tenant RBAC foundation initialized.
        </p>

        {/* Authentication State Card */}
        <div className="pt-2">
          <Show when="signed-out">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <p className="text-sm text-zinc-400">
                You are currently <span className="text-amber-400 font-medium">signed out</span>.
              </p>
              <div className="flex items-center justify-center gap-3">
                <SignInButton mode="modal">
                  <Button variant="primary" size="md">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="secondary" size="md">
                    Sign Up
                  </Button>
                </SignUpButton>
              </div>
            </div>
          </Show>

          <Show when="signed-in">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                <UserButton />
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Signed In</p>
                  <p className="text-xs text-emerald-400">Active Clerk Session</p>
                </div>
              </div>
              <Link href="/dashboard">
                <Button variant="primary" size="sm">
                  Go to Dashboard →
                </Button>
              </Link>
            </div>
          </Show>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <a
            href="http://localhost:4000/api/v1/health"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Check API Health ↗
          </a>
        </div>

        <div className="pt-10 grid grid-cols-3 gap-3 text-left border-t border-zinc-800">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400">Web App</span>
            <p className="text-sm font-semibold text-zinc-200">Next.js 15 + Clerk</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400">NestJS API</span>
            <p className="text-sm font-semibold text-zinc-200">Guards & RBAC</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400">Multi-Tenancy</span>
            <p className="text-sm font-semibold text-zinc-200">AsyncLocalStorage</p>
          </div>
        </div>
      </div>
    </main>
  );
}
