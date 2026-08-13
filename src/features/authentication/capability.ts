export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SessionIdentity {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatar: string | null;
}

export interface AuthenticatedSession {
  token: string;
  user: SessionIdentity;
}

export type AuthenticationFailureKind =
  | "duplicate-email"
  | "invalid-credentials"
  | "offline"
  | "network"
  | "server"
  | "malformed"
  | "unknown";

export class AuthenticationFailure extends Error {
  readonly kind: AuthenticationFailureKind;

  constructor(kind: AuthenticationFailureKind) {
    super("Authentication request failed.");
    this.name = "AuthenticationFailure";
    this.kind = kind;
  }
}

export interface AuthenticationCapability {
  register(input: RegistrationInput, signal?: AbortSignal): Promise<void>;
  signIn(input: SignInInput, signal?: AbortSignal): Promise<AuthenticatedSession>;
}
