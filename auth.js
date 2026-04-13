// ── AUTH.JS ───────────────────────────────────────────────
// Loaded FIRST in index.html — redirects to login if no session,
// exposes Auth.userId, Auth.geminiKey for the rest of the app.

const SUPABASE_URL = 'https://ylhqhjjakztxyrzoaaok.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaHFoampha3p0eHlyem9hYW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODIyODksImV4cCI6MjA5MTU1ODI4OX0.79YaM7pdbimRTqcEs7paQ_0D5PziNE83lPbCtFD-ljg';

const Auth = (() => {
  let _session = null;
  let _userId  = null;

  function _loadSession() {
    try {
      const raw = localStorage.getItem('tf_session');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  async function _refreshToken(session) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      localStorage.setItem('tf_session', JSON.stringify(data));
      return data;
    } catch { return null; }
  }

  async function init() {
    const session = _loadSession();
    if (!session?.access_token) {
      window.location.href = 'login.html';
      return false;
    }

    // Check expiry (Supabase tokens expire in 1 hour, expires_at is unix seconds)
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && now >= session.expires_at - 60) {
      const refreshed = await _refreshToken(session);
      if (!refreshed) {
        localStorage.removeItem('tf_session');
        window.location.href = 'login.html';
        return false;
      }
      _session = refreshed;
    } else {
      _session = session;
    }

    _userId = _session.user?.id;
    if (!_userId) {
      window.location.href = 'login.html';
      return false;
    }

    return true;
  }

  function getAccessToken() { return _session?.access_token || ''; }
  function getUserId()      { return _userId; }
  function getGeminiKey()   { return localStorage.getItem('tf_gemini_key') || ''; }
  function getUserName()    {
    return _session?.user?.user_metadata?.name
        || localStorage.getItem('tf_new_user_name')
        || 'Manager';
  }

  function signOut() {
    // Call Supabase logout then clear local state
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
      },
    }).finally(() => {
      localStorage.removeItem('tf_session');
      localStorage.removeItem('tf_new_user_name');
      window.location.href = 'login.html';
    });
  }

  // Prompt for Gemini key if not set (called from voice button)
  function promptGeminiKey(onDone) {
    const existing = getGeminiKey();
    if (existing) { onDone(existing); return; }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.65);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;padding:24px;
    `;
    overlay.innerHTML = `
      <div style="
        width:100%;max-width:440px;
        background:var(--surface);border:1px solid var(--border);
        border-radius:16px;overflow:hidden;
        box-shadow:var(--shadow-lg);
        animation:slideUp .22s ease both;
      ">
        <div style="padding:22px 24px 0;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="
              width:40px;height:40px;border-radius:10px;
              background:linear-gradient(135deg,#f59e0b,#ef4444);
              display:flex;align-items:center;justify-content:center;
              font-size:20px;
            ">✦</div>
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--text)">Add Gemini API Key</div>
              <div style="font-size:12px;color:var(--text3)">Required for voice-to-task AI</div>
            </div>
          </div>
          <button id="_gSkip" style="
            background:none;border:none;color:var(--text3);
            font-size:20px;cursor:pointer;line-height:1;padding:4px;
          ">×</button>
        </div>
        <div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:12px;">
          <p style="font-size:13px;color:var(--text2);line-height:1.6;">
            Your key is stored <strong>only in your browser</strong> and goes directly to Google — TaskFlow never sees it.
            Get one free at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--indigo)">aistudio.google.com/apikey</a>
          </p>
          <input id="_gKeyInput" type="password" placeholder="AIzaSy…" style="
            padding:10px 14px;
            border:1.5px solid var(--border);border-radius:8px;
            background:var(--surface2);color:var(--text);
            font-family:'Inter',sans-serif;font-size:14px;
            outline:none;width:100%;
          " />
          <div style="display:flex;gap:8px;">
            <button id="_gSkip2" style="
              flex:1;padding:10px;
              background:var(--surface2);border:1.5px solid var(--border);
              border-radius:8px;color:var(--text2);
              font-family:'Inter',sans-serif;font-size:13px;font-weight:500;cursor:pointer;
            ">Skip</button>
            <button id="_gSave" style="
              flex:2;padding:10px;
              background:var(--indigo);border:none;
              border-radius:8px;color:#fff;
              font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;
            ">Save Key & Continue</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = (save) => {
      const key = document.getElementById('_gKeyInput').value.trim();
      if (save && key) localStorage.setItem('tf_gemini_key', key);
      overlay.remove();
      onDone(save && key ? key : '');
    };

    document.getElementById('_gSkip').addEventListener('click', () => close(false));
    document.getElementById('_gSkip2').addEventListener('click', () => close(false));
    document.getElementById('_gSave').addEventListener('click', () => close(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    document.getElementById('_gKeyInput').focus();
  }

  return { init, getUserId, getAccessToken, getGeminiKey, getUserName, signOut, promptGeminiKey };
})();
