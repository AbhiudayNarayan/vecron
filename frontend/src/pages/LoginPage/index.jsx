import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { axiosClient } from "../../utils/axiosClient";
import ParticleBackground from "../../components/ParticleBackground";
import { useAuth } from "../../context/MainContext";

/**
 * LoginPage
 * Matches RegisterPage's design exactly: same brand wordmark, same social
 * buttons, same card layout. Calls POST /auth/login, stores the JWT in
 * localStorage, then redirects to /dashboard.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // ── Controlled inputs ──────────────────────────────────────────────────────
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [rememberMe,  setRememberMe]  = useState(false);
  const [showPassword,setShowPassword]= useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Please enter a valid email address.";
    if (!password)
      next.password = "Please enter your password.";
    return next;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const next = validate();
    if (Object.keys(next).length > 0) { setErrors(next); return; }

    setLoading(true);
    try {
      const response = await axiosClient.post("/auth/login", { email, password });

      login(response.data.access_token, rememberMe);
      navigate("/dashboard");
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.message ||
        "Login failed. Please try again.";
      setErrors({ server: msg });
    } finally {
      setLoading(false);
    }
  };

  // Stubbed OAuth — replace with window.location.href = `${API_BASE}/auth/google`
  const handleSocialLogin = (provider) => {
    console.log(`Login with ${provider}`);
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputBase =
    "w-full rounded-lg border px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2";
  const inputState = (field) =>
    errors[field]
      ? "border-red-400 focus:border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <ParticleBackground/>
      {/*
        Drop your background component here, same as RegisterPage:
        <FloatingIconsBackground />   or   <WaveBackground />
      */}

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        {/* Brand wordmark */}
        <div className="mb-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
              V
            </span>
            <span>VECRON</span>
          </Link>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your account to continue.
          </p>
        </div>

        {/* Social login */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSocialLogin("google")}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("github")}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* Server-level error (wrong credentials, server down, etc.) */}
          {errors.server && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {errors.server}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${inputBase} ${inputState("email")}`}
            />
            {errors.email && (
              <p className="mt-1.5 text-sm font-medium text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Password + show/hide */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              {/* Forgot password — wire to /forgot-password route when ready */}
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputBase} ${inputState("password")} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition hover:text-gray-600"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-sm font-medium text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Keep me signed in
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {loading ? <><Spinner />Signing in…</> : "Sign In"}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ── Inline icons (identical to RegisterPage — consider moving to a shared icons file) */
function EyeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg className="h-5 w-5" fill="#181717" viewBox="0 0 24 24">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}