import type { ReactNode } from "react";
import type { TaxonomyCapability } from "./capability";
import { TaxonomyContext } from "./context";

export function TaxonomyProvider({
  capability,
  children,
}: {
  capability: TaxonomyCapability;
  children: ReactNode;
}) {
  return <TaxonomyContext.Provider value={capability}>{children}</TaxonomyContext.Provider>;
}
