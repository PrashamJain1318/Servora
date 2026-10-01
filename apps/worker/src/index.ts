/**
 * SERVORA — Background Job Worker (Phase 1 Stub)
 * Responsible for asynchronous jobs, notifications, and scheduled tasks in Phase 2+.
 */

const WORKER_NAME = 'servora-worker';

console.log(
  `[${new Date().toISOString()}] [INFO] [${WORKER_NAME}] Servora background worker initialized and running.`,
);

let isShuttingDown = false;

// Heartbeat interval to maintain event loop activity
const heartbeatInterval = setInterval(() => {
  if (!isShuttingDown) {
    // Keep alive silently; logs periodically in verbose mode if needed
  }
}, 60000);

function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(
    `[${new Date().toISOString()}] [INFO] [${WORKER_NAME}] Received ${signal}. Shutting down worker gracefully...`,
  );
  clearInterval(heartbeatInterval);

  // Allow pending synchronous flushes then exit cleanly
  setTimeout(() => {
    console.log(`[${new Date().toISOString()}] [INFO] [${WORKER_NAME}] Worker stopped cleanly.`);
    process.exit(0);
  }, 100);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
