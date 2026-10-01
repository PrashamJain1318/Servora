import React from 'react';
import { Button } from '@servora/ui';
import { APP_CONFIG } from '@servora/config';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-center">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-wider">
          Phase 1 Foundation • Active
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
          {APP_CONFIG.name}
        </h1>

        <p className="text-xl sm:text-2xl text-zinc-400 font-medium italic">
          &ldquo;{APP_CONFIG.tagline}&rdquo;
        </p>

        <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
          The AI-powered growth and operations platform for appointment-based service businesses.
          Monorepo development environment initialized and running.
        </p>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="md">
            Development Mode
          </Button>
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
            <p className="text-sm font-semibold text-zinc-200">Port 3000</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400">NestJS API</span>
            <p className="text-sm font-semibold text-zinc-200">Port 4000</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-xs font-mono text-zinc-400">Worker</span>
            <p className="text-sm font-semibold text-zinc-200">Standalone</p>
          </div>
        </div>
      </div>
    </main>
  );
}
