export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  avatar: string | null;
  gender: boolean;
  role: string;
  skills: string[];
  certifications: string[];
}

export interface EditableProfile {
  name: string;
  phone: string;
  birthday: string;
  gender: boolean;
  skills: string[];
  certifications: string[];
}

export type ProfileFailureKind = "cancelled" | "not_found" | "unauthorized" | "forbidden" | "offline" | "network" | "server" | "malformed" | "stale" | "unknown";

export class ProfileFailure extends Error {
  readonly kind: ProfileFailureKind;
  constructor(kind: ProfileFailureKind) {
    super("Profile request failed.");
    this.name = "ProfileFailure";
    this.kind = kind;
  }
}

export interface ProfileCapability {
  getProfile(userId: string, sessionToken: string, signal?: AbortSignal): Promise<Profile>;
  updateProfile(profile: Profile, changes: EditableProfile, sessionToken: string, signal?: AbortSignal): Promise<Profile>;
  uploadAvatar(userId: string, file: File, sessionToken: string, signal?: AbortSignal): Promise<Profile>;
}
