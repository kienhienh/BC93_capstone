import type { ReactNode } from "react";
import type { ServicePreviewCapability } from "./capability";
import { ServicePreviewContext } from "./context";

export function ServicePreviewProvider({
  capability,
  children,
}: {
  capability: ServicePreviewCapability;
  children: ReactNode;
}) {
  return (
    <ServicePreviewContext.Provider value={capability}>
      {children}
    </ServicePreviewContext.Provider>
  );
}
