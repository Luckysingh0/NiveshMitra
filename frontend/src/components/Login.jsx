import React, { useEffect, useRef, useState } from "react";
import { api, getSessionId, setSessionId } from "../api/client.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function Login({ theme, onToggleTheme, onBack, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleBtnRef = useRef(null);

  // ---- Google Identity Services button ----
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    function init() {
      if (cancelled) return;
      const g = window.google;
      if (!g?.accounts?.id || !googleBtnRef.current) {
        // GIS script not ready yet — retry shortly.
        setTimeout(init, 200);
        return;
      }
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  async function handleGoogleCredential(response) {
    const credential = response?.credential;
    if (!credential) {
      setError("Google sign-in was cancelled.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.googleLogin(getSessionId(), credential);
      if (res.sessionId) setSessionId(res.sessionId);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const mail = email.trim();
    if (!mail) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.login(mail, password);
      if (res.sessionId) setSessionId(res.sessionId);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || "Could not sign you in.");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <button
        className="ghost icon-btn auth-theme"
        onClick={onToggleTheme}
        title={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="logo">🪙</span>
          <h1>NiveshMitra</h1>
        </div>
        <h2 className="auth-title">Welcome back 👋</h2>
        <p className="auth-sub">
          Sign in with your email and password to continue. New here? Just pick
          any password — we'll remember you by your email.
        </p>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="google-btn-wrap" ref={googleBtnRef} />
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        <label className="auth-label">
          Email
          <input
            type="email"
            value={email}
            autoFocus
            placeholder="you@example.com"
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </label>

        <label className="auth-label">
          Password
          <input
            type="password"
            value={password}
            placeholder="••••••••"
            autoComplete="current-password"
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="cta-btn full" disabled={busy}>
          {busy ? "Signing you in…" : "Sign in →"}
        </button>
        <button type="button" className="auth-back" onClick={onBack}>
          ← Back to home
        </button>
      </form>
    </div>
  );
}
