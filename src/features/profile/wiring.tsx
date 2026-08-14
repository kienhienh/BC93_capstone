import type { ReactNode } from "react";
import type { ProfileCapability } from "./capability";
import { ProfileContext } from "./context";

export type { ProfileCapability } from "./capability";
export function ProfileProvider({ capability, children }: { capability: ProfileCapability; children: ReactNode }) {
  return <ProfileContext.Provider value={capability}>{children}</ProfileContext.Provider>;
}
