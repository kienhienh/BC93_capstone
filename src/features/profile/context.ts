import { createContext, useContext } from "react";
import type { ProfileCapability } from "./capability";

export const ProfileContext = createContext<ProfileCapability | null>(null);
export function useProfileCapability() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("Profile capability is unavailable.");
  return value;
}
