import { normalizeName, normalizePhone, validateName, validatePhone } from "../authentication/validation";
import type { EditableProfile } from "./capability";

export function normalizeTags(value: string) {
  const seen = new Set<string>();
  return value.split(",").map((item) => item.trim()).filter((item) => {
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function validateProfile(values: EditableProfile) {
  const errors: Partial<Record<"name" | "phone" | "birthday", string>> = {};
  const name = normalizeName(values.name);
  const phone = normalizePhone(values.phone);
  if (!validateName(name)) errors.name = "Full name must contain 2–50 characters.";
  if (!validatePhone(phone)) errors.phone = "Phone must contain 9–15 digits.";
  if (values.birthday && Number.isNaN(Date.parse(values.birthday))) errors.birthday = "Enter a valid birthday.";
  return Object.keys(errors).length ? { ok: false as const, errors } : { ok: true as const, input: { ...values, name, phone } };
}
