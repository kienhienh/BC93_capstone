import type { AdminUser, UpdateUserInput } from "./capability";

export type GuardFeedback = {
  state: "validation-failure" | "blocked-dependency" | "stale" | "unknown-outcome";
  message: string;
};

export function userEvidence(user: AdminUser) {
  return JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    avatar: user.avatar,
    gender: user.gender,
    role: user.role,
    skills: [...user.skills],
    certifications: [...user.certifications],
  });
}

export function sameUserEvidence(left: AdminUser, right: AdminUser) {
  return userEvidence(left) === userEvidence(right);
}

export function userMatchesUpdate(user: AdminUser, input: UpdateUserInput) {
  if (input.name !== undefined && user.name !== input.name) return false;
  if (input.email !== undefined && user.email !== input.email) return false;
  if (input.phone !== undefined && user.phone !== input.phone) return false;
  if (input.birthday !== undefined && user.birthday !== input.birthday) return false;
  if (input.gender !== undefined && user.gender !== input.gender) return false;
  if (input.role !== undefined && user.role !== input.role) return false;
  if (input.skills !== undefined && JSON.stringify(user.skills) !== JSON.stringify(input.skills)) return false;
  if (input.certifications !== undefined && JSON.stringify(user.certifications) !== JSON.stringify(input.certifications)) return false;
  return true;
}

export function isSameIdentity(
  sessionUser: { id: string; email: string } | undefined,
  target: AdminUser,
) {
  return Boolean(sessionUser && (sessionUser.id === target.id || sessionUser.email === target.email));
}

export async function proveAnotherAdministrator(
  targetId: string,
  listAllUsers: () => Promise<readonly AdminUser[]>,
) {
  const users = await listAllUsers();
  return users.some((user) => user.id !== targetId && user.role === "ADMIN");
}
