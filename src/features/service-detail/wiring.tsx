import type { ReactNode } from "react";
import { ServiceDetailContext } from "./context";
import type { ServiceDetailCapability } from "./capability";

export type { ServiceDetailCapability } from "./capability";

export function ServiceDetailProvider({
  capability,
  children,
}: {
  capability: ServiceDetailCapability;
  children: ReactNode;
}) {
  return (
    <ServiceDetailContext.Provider value={capability}>
      {children}
    </ServiceDetailContext.Provider>
  );
}
