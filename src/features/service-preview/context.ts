import { createContext, useContext } from "react";
import type { ServicePreviewCapability } from "./capability";

export const ServicePreviewContext = createContext<ServicePreviewCapability | null>(null);

export function useServicePreviewCapability(): ServicePreviewCapability {
  const capability = useContext(ServicePreviewContext);

  if (!capability) {
    throw new Error("Service preview capability is not configured.");
  }

  return capability;
}
