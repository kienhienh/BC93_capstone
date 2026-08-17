import type {
  AdminUser,
  CanonicalAdminUserRole,
  CreateUserInput,
  UpdateUserInput,
} from "./capability";

export type UserFormState = {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: boolean;
  role: CanonicalAdminUserRole | "";
  skills: string;
  certifications: string;
};

function tags(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function isCanonicalRole(role: string): role is CanonicalAdminUserRole {
  return role === "USER" || role === "ADMIN";
}

export function toCreateInput(form: UserFormState): CreateUserInput {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    birthday: form.birthday,
    gender: form.gender,
    role: form.role === "ADMIN" ? "ADMIN" : "USER",
    skills: tags(form.skills),
    certifications: tags(form.certifications),
  };
}

export function toUpdateInput(original: AdminUser, form: UserFormState): UpdateUserInput {
  const input: UpdateUserInput = {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    birthday: form.birthday,
    gender: form.gender,
    skills: tags(form.skills),
    certifications: tags(form.certifications),
  };
  if (form.role) input.role = form.role;
  else if (isCanonicalRole(original.role)) input.role = original.role;
  return input;
}

export function emptyForm(): UserFormState {
  return {
    name: "",
    email: "",
    phone: "",
    birthday: "",
    gender: true,
    role: "USER",
    skills: "",
    certifications: "",
  };
}

export function formFromUser(user: AdminUser): UserFormState {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    gender: user.gender,
    role: isCanonicalRole(user.role) ? user.role : "",
    skills: user.skills.join(", "),
    certifications: user.certifications.join(", "),
  };
}
