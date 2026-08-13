import { createContext, useContext } from "react";
import type { ServiceDiscoveryCapability } from "./capability";

export const ServiceDiscoveryContext = createContext<ServiceDiscoveryCapability | null>(null);

export function useServiceDiscoveryCapability() {
  const capability = useContext(ServiceDiscoveryContext);
  if (!capability) throw new Error("Service discovery capability is unavailable.");
  return capability;
}
