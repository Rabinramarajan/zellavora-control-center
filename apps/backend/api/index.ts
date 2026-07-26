/**
 * Vercel serverless entrypoint.
 *
 * `@vercel/node` accepts an Express application as the default export and
 * drives it directly — no `serverless-http` wrapper and no `app.listen()`.
 * Calling `listen()` here would bind a port that the platform never routes to
 * and hold the invocation open until it times out; the long-lived server
 * entrypoint lives in `src/index.ts` and is used only by Docker/local dev.
 *
 * Nothing in this file may throw at module scope: the whole module graph is
 * evaluated during cold start, and an exception there is reported only as an
 * opaque FUNCTION_INVOCATION_FAILED with no stack trace in the response.
 */
import app from '../src/app';

// A rejected promise with no handler terminates the Node process by default
// (and has since Node 15), turning one bad request into a dead instance that
// fails every in-flight request. Log and keep serving instead.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

export default app;
