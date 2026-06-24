import React, { useState } from "react";

export default function Login({ theme, onToggleTheme, onBack, onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name to continue.");
      return;
    }
    onLogin({ name: trimmed, email: email.trim() });
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
        <h2 className="auth-title">Welcome 👋</h2>
        <p className="auth-sub">
          Tell us your name so NiveshMitra can greet you properly. No password
          needed — this is a friendly start.
        </p>

        <label className="auth-label">
          Your name
          <input
            type="text"
            value={name}
            autoFocus
            placeholder="e.g. Aarav"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </label>

        <label className="auth-label">
          Email <span className="optional">(optional)</span>
          <input
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="cta-btn full">
          Continue to chat →
        </button>
        <button type="button" className="auth-back" onClick={onBack}>
          ← Back to home
        </button>
      </form>
    </div>
  );
}
