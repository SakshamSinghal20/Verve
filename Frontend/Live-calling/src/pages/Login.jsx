import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");

            localStorage.setItem("verve-token", data.token);
            localStorage.setItem("verve-user", JSON.stringify(data.user));
            navigate("/");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-container">
            <form className="auth-card" onSubmit={handleSubmit}>
                <h1 className="auth-logo">Verve</h1>
                <p className="auth-subtitle">Sign in to your account</p>

                {error && <div className="auth-error">{error}</div>}

                <div className="auth-field">
                    <label htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="auth-field">
                    <label htmlFor="login-password">Password</label>
                    <input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="auth-btn" disabled={loading} id="btn-login">
                    {loading ? "Signing in…" : "Sign In"}
                </button>

                <p className="auth-link">
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>
            </form>
        </div>
    );
}

export default Login;
