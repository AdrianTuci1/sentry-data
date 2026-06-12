import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { LogIn, UserPlus, AlertCircle } from "lucide-react";
import "@/styles/login.css";

export function LoginView() {
  const { login, register, demoMode, toggleDemoMode, currentUser } = useAppStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (currentUser) {
    navigate("/app", { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, firstName, lastName });
      }
      navigate("/app/home", { replace: true });
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Sentry Platform</h1>
          <p className="login-subtitle">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {mode === "register" && (
            <div className="login-field-row">
              <label className="login-field">
                <span>First Name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </label>
              <label className="login-field">
                <span>Last Name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </label>
            </div>
          )}

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </label>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {mode === "login" ? (
              <>
                <LogIn size={16} />
                {loading ? "Signing in..." : "Sign In"}
              </>
            ) : (
              <>
                <UserPlus size={16} />
                {loading ? "Creating..." : "Create Account"}
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <button
            className="login-toggle-mode"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          <div className="login-divider" />

          <button
            className={`login-demo-mode-btn ${demoMode ? "active" : ""}`}
            onClick={toggleDemoMode}
          >
            {demoMode ? "Demo Mode: ON" : "Demo Mode: OFF"}
          </button>
          <p className="login-demo-hint">
            {demoMode
              ? "Using mock data. Toggle off to connect to backend."
              : "Toggle on to explore with demo data."}
          </p>
        </div>
      </div>
    </div>
  );
}
