import React, { useEffect, useState } from "react";
import App from "./App.jsx";
import Landing from "./components/Landing.jsx";
import Login from "./components/Login.jsx";

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("nm_user") || "null");
  } catch {
    return null;
  }
}

export default function Root() {
  const initialUser = readUser();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("nm_theme") || "dark",
  );
  const [user, setUser] = useState(initialUser);
  const [view, setView] = useState(initialUser ? "chat" : "landing");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nm_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  function handleLogin(u) {
    localStorage.setItem("nm_user", JSON.stringify(u));
    setUser(u);
    setView("chat");
  }

  function handleLogout() {
    localStorage.removeItem("nm_user");
    setUser(null);
    setView("landing");
  }

  if (view === "chat" && user) {
    return (
      <App
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "login") {
    return (
      <Login
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={() => setView("landing")}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Landing
      theme={theme}
      onToggleTheme={toggleTheme}
      onStart={() => setView(user ? "chat" : "login")}
    />
  );
}
