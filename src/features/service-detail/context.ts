import { createContext, useContext } from "react";
import type { ServiceDetailCapability } from "./capability";

export const ServiceDetailContext = createContext<ServiceDetailCapability | null>(null);

export function useServiceDetailCapability() {
  const capability = useContext(ServiceDetailContext);
  if (!capability) throw new Error("Service Detail capability is unavailable.");
  return capability;
}
