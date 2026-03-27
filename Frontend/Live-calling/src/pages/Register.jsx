import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function Register() {
    const [name, setName] = useState("");
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
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Registration failed");

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
                <p className="auth-subtitle">Create your account</p>

                {error && <div className="auth-error">{error}</div>}

                <div className="auth-field">
                    <label htmlFor="register-name">Name</label>
                    <input
                        id="register-name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="auth-field">
                    <label htmlFor="register-email">Email</label>
                    <input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="auth-field">
                    <label htmlFor="register-password">Password</label>
                    <input
                        id="register-password"
                        type="password"
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                    />
                </div>

                <button type="submit" className="auth-btn" disabled={loading} id="btn-register">
                    {loading ? "Creating account…" : "Create Account"}
                </button>

                <p className="auth-link">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </form>
        </div>
    );
}

export default Register;
