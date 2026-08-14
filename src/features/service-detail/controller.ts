import { useQuery } from "@tanstack/react-query";
import { useServiceDetailCapability } from "./context";

export function useServiceDetail(serviceId: string) {
  const capability = useServiceDetailCapability();
  return useQuery({
    queryKey: ["service-detail", serviceId],
    queryFn: ({ signal }) => capability.getService(serviceId, signal),
    enabled: serviceId.length > 0,
  });
}

export function useServiceComments(serviceId: string) {
  const capability = useServiceDetailCapability();
  return useQuery({
    queryKey: ["service-comments", serviceId],
    queryFn: ({ signal }) => capability.listComments(serviceId, signal),
    enabled: serviceId.length > 0,
  });
}
