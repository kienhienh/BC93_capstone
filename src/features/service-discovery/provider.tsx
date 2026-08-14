import type { ReactNode } from "react";
import type { ServiceDiscoveryCapability } from "./capability";
import { ServiceDiscoveryContext } from "./context";

export function ServiceDiscoveryProvider({ capability, children }: { capability: ServiceDiscoveryCapability; children: ReactNode }) {
  return <ServiceDiscoveryContext.Provider value={capability}>{children}</ServiceDiscoveryContext.Provider>;
}
