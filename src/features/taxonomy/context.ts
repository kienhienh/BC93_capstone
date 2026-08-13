import { createContext, useContext } from "react";
import type { TaxonomyCapability } from "./capability";

export const TaxonomyContext = createContext<TaxonomyCapability | null>(null);

export function useTaxonomyCapability() {
  const capability = useContext(TaxonomyContext);
  if (!capability) throw new Error("Taxonomy capability is unavailable.");
  return capability;
}
