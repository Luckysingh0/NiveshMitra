// Tiny fetch wrapper. Vite proxies /api -> backend:5000.

export function getSessionId() {
  let id = localStorage.getItem("nm_session");
  if (!id) {
    id =
      "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("nm_session", id);
  }
  return id;
}

export function resetSession() {
  localStorage.removeItem("nm_session");
}

// Adopt a server-issued session id (e.g. a stable per-Google-account id) so
// the frontend and backend agree on which conversation/history to use.
export function setSessionId(id) {
  if (id) localStorage.setItem("nm_session", id);
}

async function req(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  sendMessage: (sessionId, message, thinkMode = false) =>
    req("/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId, message, thinkMode }),
    }),
  getPlan: (sessionId) => req(`/plan/${sessionId}`),
  getProfile: (sessionId) => req(`/profile/${sessionId}`),
  health: () => req("/health"),
  login: (email, password) =>
    req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  saveBasicInfo: (sessionId, info) =>
    req("/auth/basic-info", {
      method: "POST",
      body: JSON.stringify({ sessionId, ...info }),
    }),
  googleLogin: (sessionId, credential) =>
    req("/auth/google", {
      method: "POST",
      body: JSON.stringify({ sessionId, credential }),
    }),
};
