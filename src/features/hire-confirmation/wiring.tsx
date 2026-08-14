import type { ReactNode } from "react";
import type { HireConfirmationCapability } from "./capability";
import { HireConfirmationContext } from "./context";

export type { HireConfirmationCapability } from "./capability";

export function HireConfirmationProvider({ capability, children }: {
  capability: HireConfirmationCapability;
  children: ReactNode;
}) {
  return (
    <HireConfirmationContext.Provider value={capability}>
      {children}
    </HireConfirmationContext.Provider>
  );
}
