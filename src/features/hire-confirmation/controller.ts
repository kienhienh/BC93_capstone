import { useMutation, useQuery } from "@tanstack/react-query";
import { HireFailure, type HireService } from "./capability";
import { useHireConfirmationCapability } from "./context";

export function useHireService(serviceId: string, enabled: boolean) {
  const capability = useHireConfirmationCapability();
  return useQuery({
    queryKey: ["hire-confirmation", "service", serviceId],
    enabled,
    queryFn: ({ signal }) => capability.getService(serviceId, signal),
  });
}

function sameReview(reviewed: HireService, latest: HireService) {
  return reviewed.id === latest.id
    && reviewed.title === latest.title
    && reviewed.price === latest.price
    && reviewed.seller?.id === latest.seller?.id
    && reviewed.seller?.name === latest.seller?.name;
}

export function useConfirmHire() {
  const capability = useHireConfirmationCapability();
  return useMutation({
    mutationFn: async ({ reviewed, userId, sessionToken, hiredAt }: {
      reviewed: HireService;
      userId: string;
      sessionToken: string;
      hiredAt: string;
    }) => {
      const latest = await capability.getService(reviewed.id, new AbortController().signal);
      if (!latest.seller) throw new HireFailure("missing_data");
      if (latest.seller.id === userId) throw new HireFailure("self_hire");
      if (!sameReview(reviewed, latest)) throw new HireFailure("stale", latest);

      const result = await capability.createHire({
        serviceId: latest.id,
        userId,
        sessionToken,
        hiredAt,
      });
      const pending = { serviceId: latest.id, userId, hiredAt };
      let hiredServices;
      try {
        hiredServices = await capability.listHiredServices(sessionToken);
      } catch {
        throw new HireFailure(
          result.kind === "accepted" ? "accepted_pending" : "reconciliation_failed",
          undefined,
          result.kind === "accepted" ? result.hireId : undefined,
          pending,
        );
      }
      const observed = hiredServices.find((item) =>
        result.kind === "accepted"
          ? item.id === result.hireId
          : item.serviceId === latest.id && item.userId === userId && item.hiredAt === hiredAt,
      );
      if (!observed) {
        throw new HireFailure(
          result.kind === "accepted" ? "accepted_pending" : "unknown_reconciled",
          undefined,
          result.kind === "accepted" ? result.hireId : undefined,
          pending,
        );
      }
      return { service: latest, hiredService: observed };
    },
  });
}

export function useCheckHiredService() {
  const capability = useHireConfirmationCapability();
  return useMutation({
    mutationFn: async ({ sessionToken, hireId, serviceId, userId, hiredAt }: {
      sessionToken: string;
      hireId?: string;
      serviceId: string;
      userId: string;
      hiredAt: string;
    }) => {
      const hiredServices = await capability.listHiredServices(sessionToken);
      return hiredServices.find((item) => hireId
        ? item.id === hireId
        : item.serviceId === serviceId && item.userId === userId && item.hiredAt === hiredAt) ?? null;
    },
  });
}

export function useHiredServices(sessionToken: string | null) {
  const capability = useHireConfirmationCapability();
  return useQuery({
    queryKey: ["hired-services", sessionToken],
    enabled: Boolean(sessionToken),
    queryFn: ({ signal }) => capability.listHiredServices(sessionToken ?? "", signal),
  });
}
