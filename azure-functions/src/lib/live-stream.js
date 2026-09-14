const { createHash } = require('node:crypto');

// A bounded, authenticated HTTP stream. Read only reports needed by this view.
// Billing keeps its existing durable cache; no new infrastructure is required.
function snapshotStream({ read, resources, intervalMs = 20000, durationMs = 180000 }) {
  const encoder = new TextEncoder();
  let stopped = false, timer, endTimer, controller;
  const hashes = new Map(), next = new Map();
  function send(event, value) {
    if (!stopped) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
  }
  function stop(close) {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer); clearTimeout(endTimer);
    if (close) controller.close();
  }
  async function tick() {
    for (const resource of resources) {
      if (stopped) return;
      if ((next.get(resource) || 0) > Date.now()) continue;
      next.set(resource, Date.now() + (resource === 'analytics' ? 90000 : resource === 'costs' ? 3600000 : intervalMs));
      try {
        const result = await read(resource);
        if (stopped) return;
        if (result.status !== 200) {
          hashes.delete(resource);
          send('report-error', { resource, message: result.jsonBody?.error || 'Report temporarily unavailable.' });
          if (result.status === 401 || result.status === 403) { stop(true); return; }
          continue;
        }
        const hash = createHash('sha256').update(JSON.stringify(result.jsonBody)).digest('hex');
        if (hashes.get(resource) !== hash) {
          send('snapshot', { resource, data: result.jsonBody });
          hashes.set(resource, hash);
        }
      } catch {
        hashes.delete(resource);
        send('report-error', { resource, message: 'Live report temporarily unavailable. Retrying automatically.' });
      }
    }
    if (!stopped) { send('heartbeat', { at: new Date().toISOString() }); timer = setTimeout(tick, intervalMs); }
  }
  return new ReadableStream({
    start(c) {
      controller = c;
      send('connected', { at: new Date().toISOString() });
      endTimer = setTimeout(() => stop(true), durationMs);
      void tick();
    },
    cancel() { stop(false); }
  });
}
module.exports = { snapshotStream };
