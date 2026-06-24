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
};
