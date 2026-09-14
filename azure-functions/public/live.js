// Fetch streaming keeps the bearer token in an Authorization header, never a URL.
function startDashboardLive({ getToken, query, onSnapshot, onStatus, onError }) {
  let stopped = false, active = false, controller, retryTimer, watchdog, failures = 0;
  const hashes = new Map();
  const status = value => { if (!stopped) onStatus(value); };
  async function connect() {
    if (stopped || document.hidden || active) return;
    active = true;
    clearTimeout(retryTimer);
    controller = new AbortController();
    const signal = controller.signal;
    status(failures ? 'Reconnecting…' : 'Connecting…');
    function armWatchdog() { clearTimeout(watchdog); watchdog = setTimeout(() => controller.abort(), 150000); }
    try {
      armWatchdog();
      const response = await fetch('/api/dashboard-live?' + query, { headers:{Authorization:'Bearer '+await getToken()},signal,cache:'no-store' });
      if (!response.ok || !response.body) throw new Error('Live connection unavailable ('+response.status+').');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        armWatchdog();
        buffer += decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
        if (buffer.length > 20000000) throw new Error('Live report is too large.');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const lines = buffer.slice(0,boundary).split('\n'); buffer = buffer.slice(boundary+2);
          const event = lines.find(line=>line.startsWith('event: '))?.slice(7);
          const raw = lines.filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n');
          if (!raw || stopped) continue;
          const message = JSON.parse(raw);
          if (event === 'connected' || event === 'heartbeat') { failures=0; status('Live connection'); }
          if (event === 'snapshot') {
            if (hashes.get(message.resource) !== raw) { onSnapshot(message.resource,message.data); hashes.set(message.resource,raw); }
          }
          if (event === 'report-error') { hashes.delete(message.resource); onError(message.resource,message.message); }
        }
      }
      failures = 0;
    } catch(e) {
      if (!stopped && !document.hidden) { failures++; status(navigator.onLine ? 'Reconnecting…' : 'Offline'); }
    } finally {
      active = false;
      clearTimeout(watchdog);
      if (!stopped && !document.hidden) retryTimer = setTimeout(connect, Math.min(30000,1000 * 2 ** Math.min(failures,5)));
    }
  }
  function visibility() {
    clearTimeout(retryTimer);
    if (document.hidden) { controller?.abort(); status('Updates paused · tab inactive'); }
    else connect();
  }
  document.addEventListener('visibilitychange',visibility);
  if(document.hidden)status('Updates paused · tab inactive');else void connect();
  return () => { stopped=true; clearTimeout(retryTimer); clearTimeout(watchdog); controller?.abort(); document.removeEventListener('visibilitychange',visibility); };
}
