import { createContext, useContext } from "react";
import type { HireConfirmationCapability } from "./capability";

export const HireConfirmationContext = createContext<HireConfirmationCapability | null>(null);

export function useHireConfirmationCapability() {
  const capability = useContext(HireConfirmationContext);
  if (!capability) throw new Error("Hire Confirmation capability is unavailable.");
  return capability;
}
