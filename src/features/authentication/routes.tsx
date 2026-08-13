import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRegistration, useSignIn } from "./controller";
import { AuthenticationFailure } from "./capability";
import {
  validateRegistration,
  validateSignIn,
  type RegistrationErrors,
  type RegistrationField,
  type SignInErrors,
} from "./validation";

interface LoginLocationState {
  registeredEmail?: string;
  accountCreated?: boolean;
}

export function RegisterRoute() {
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const registration = useRegistration();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Register | Fiverr Clone";
    heading.current?.focus();
  }, []);

  useEffect(() => {
    focusFirstInvalidRegistrationField(errors);
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateRegistration({
      name,
      email,
      password,
      confirmPassword,
      phone,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    try {
      await registration.mutateAsync(result.input);
    } catch (error) {
      if (error instanceof AuthenticationFailure && error.kind === "duplicate-email") {
        setErrors({ email: "An account cannot be created with this email." });
      } else {
        setFormError(
          error instanceof AuthenticationFailure
            ? registrationFailureMessage(error)
            : "We could not create your account. Try again.",
        );
      }
      return;
    }
    navigate("/login", {
      replace: true,
      state: { registeredEmail: result.input.email, accountCreated: true },
    });
  }

  return (
    <main id="main-content" className="authentication-page">
      <section className="authentication-card" aria-labelledby="register-heading">
        <p className="authentication-eyebrow">Join the marketplace</p>
        <h1 id="register-heading" ref={heading} tabIndex={-1}>Create your account</h1>
        {formError ? <p role="alert">{formError}</p> : null}
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={registration.isPending}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "register-name-error" : undefined}
          />
          <FieldError id="register-name-error" message={errors.name} />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={registration.isPending}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "register-email-error" : undefined}
          />
          <FieldError id="register-email-error" message={errors.email} />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={registration.isPending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "register-password-error" : undefined}
          />
          <FieldError id="register-password-error" message={errors.password} />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={registration.isPending}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "register-confirm-password-error" : undefined
            }
          />
          <FieldError
            id="register-confirm-password-error"
            message={errors.confirmPassword}
          />

          <label htmlFor="register-phone">Phone</label>
          <input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={registration.isPending}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "register-phone-error" : undefined}
          />
          <FieldError id="register-phone-error" message={errors.phone} />

          <button type="submit" disabled={registration.isPending}>
            {registration.isPending ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="authentication-field-error" id={id}>
      {message}
    </p>
  ) : null;
}

function registrationFailureMessage(error: AuthenticationFailure) {
  switch (error.kind) {
    case "offline":
      return "You are offline. Reconnect, then try again.";
    case "network":
      return "We could not connect. Check your connection, then try again.";
    case "server":
      return "Account creation is temporarily unavailable. Try again.";
    case "malformed":
      return "Account creation returned an unsafe response. Try again later.";
    default:
      return "We could not create your account. Try again.";
  }
}

function focusFirstInvalidRegistrationField(errors: RegistrationErrors) {
  const order: RegistrationField[] = ["name", "email", "password", "confirmPassword", "phone"];
  const firstInvalid = order.find((field) => errors[field]);
  if (firstInvalid) {
    document.getElementById(`register-${toInputId(firstInvalid)}`)?.focus();
  }
}

function toInputId(field: RegistrationField) {
  return field === "confirmPassword" ? "confirm-password" : field;
}

export function LoginRoute() {
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const [email, setEmail] = useState(state?.registeredEmail ?? "");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignInErrors>({});
  const signIn = useSignIn();

  useEffect(() => {
    document.title = "Login | Fiverr Clone";
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (fieldErrors.email) {
      document.getElementById("login-email")?.focus();
    } else if (fieldErrors.password) {
      document.getElementById("login-password")?.focus();
    }
  }, [fieldErrors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSignIn({ email, password });
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors({});
    setErrorMessage(null);
    try {
      await signIn.mutateAsync(validation.input);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthenticationFailure
          ? loginFailureMessage(error)
          : "We could not sign you in. Try again.",
      );
      return;
    }
    navigate(readSafeReturnTo(location.search), { replace: true });
  }

  return (
    <main id="main-content" className="authentication-page">
      <section className="authentication-card" aria-labelledby="login-heading">
        <p className="authentication-eyebrow">Welcome back</p>
        <h1 id="login-heading" ref={heading} tabIndex={-1}>Login</h1>
        {state?.accountCreated ? (
          <p role="status">Your account was created. Sign in to continue.</p>
        ) : null}
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={signIn.isPending}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          />
          <FieldError id="login-email-error" message={fieldErrors.email} />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={signIn.isPending}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          />
          <FieldError id="login-password-error" message={fieldErrors.password} />
          <button type="submit" disabled={signIn.isPending}>
            {signIn.isPending ? "Signing in..." : "Login"}
          </button>
        </form>
        <p>
          Need an account? <Link to="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}

function loginFailureMessage(error: AuthenticationFailure) {
  switch (error.kind) {
    case "invalid-credentials":
      return "We could not sign you in with those credentials.";
    case "offline":
      return "You are offline. Reconnect, then try again.";
    case "network":
      return "We could not connect. Check your connection, then try again.";
    case "server":
      return "Login is temporarily unavailable. Try again.";
    case "malformed":
      return "Login returned an unsafe response. Try again later.";
    default:
      return "We could not sign you in. Try again.";
  }
}

function readSafeReturnTo(search: string) {
  const candidate = new URLSearchParams(search).get("returnTo");
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return "/";
  }

  const pathname = candidate.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (pathname === "/login" || pathname === "/register") {
    return "/";
  }
  return candidate;
}
