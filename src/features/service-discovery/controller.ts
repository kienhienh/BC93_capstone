import { useQuery } from "@tanstack/react-query";
import { useServiceDiscoveryCapability } from "./context";

export function useServiceDiscovery(search: string, subcategoryId: string) {
  const capability = useServiceDiscoveryCapability();
  const source = search ? "search" : subcategoryId ? "subcategory" : "complete";
  const value = search || subcategoryId;
  return useQuery({
    queryKey: ["service-discovery", source, value],
    queryFn: ({ signal }) => source === "search"
      ? capability.searchServices(search, signal)
      : source === "subcategory"
        ? capability.listServicesBySubcategory(subcategoryId, signal)
        : capability.listServices(signal),
  });
}
