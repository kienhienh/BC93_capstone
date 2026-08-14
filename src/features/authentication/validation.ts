import { z } from "zod";
import type { RegistrationInput, SignInInput } from "./capability";

export type RegistrationField =
  | "name"
  | "email"
  | "password"
  | "confirmPassword"
  | "phone";

export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

export type SignInErrors = Partial<Record<"email" | "password", string>>;

export const normalizeName = (value: string) => value.trim();
export const normalizePhone = (value: string) => value.replace(/[\s()-]/g, "");
export const validateName = (value: string) => value.length >= 2 && value.length <= 50;
export const validatePhone = (value: string) => /^\+?\d{9,15}$/.test(value);

export function validateSignIn(values: SignInInput):
  | { ok: true; input: SignInInput }
  | { ok: false; errors: SignInErrors } {
  const email = values.email.trim().toLowerCase();
  const errors: SignInErrors = {};
  if (!z.email().safeParse(email).success) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) {
    errors.password = "Enter your password.";
  }
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, input: { email, password: values.password } };
}

export function validateRegistration(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}): { ok: true; input: RegistrationInput } | { ok: false; errors: RegistrationErrors } {
  const name = normalizeName(values.name);
  const email = values.email.trim().toLowerCase();
  const phone = normalizePhone(values.phone);
  const errors: RegistrationErrors = {};

  if (!validateName(name)) {
    errors.name = "Full name must contain 2–50 characters.";
  }
  if (!z.email().safeParse(email).success) {
    errors.email = "Enter a valid email address.";
  }
  if (values.password.length < 6) {
    errors.password = "Password must contain at least 6 characters.";
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords must match.";
  }
  if (!validatePhone(phone)) {
    errors.phone = "Phone must contain 9–15 digits.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, input: { name, email, password: values.password, phone } };
}
