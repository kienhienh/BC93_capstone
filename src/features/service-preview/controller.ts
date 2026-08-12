import { useQuery } from "@tanstack/react-query";
import { useServicePreviewCapability } from "./context";

const servicePreviewQueryKey = ["service-preview"] as const;

export function useServicePreview() {
  const capability = useServicePreviewCapability();

  return useQuery({
    queryKey: servicePreviewQueryKey,
    queryFn: ({ signal }) => capability.listServices(signal),
    staleTime: 30_000,
  });
}
