import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HireFailure, type HiredService, type HireService } from "./capability";
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
  const queryClient = useQueryClient();

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

      if (result.kind !== "accepted") {
        throw new HireFailure("unknown");
      }

      const hiredService: HiredService = {
        id: result.hireId,
        serviceId: latest.id,
        userId,
        hiredAt,
        completed: false,
        service: { title: latest.title, price: latest.price },
        seller: latest.seller,
      };

      return { service: latest, hiredService };
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["hired-services"] });
      queryClient.setQueryData<HiredService[]>(["hired-services", variables.sessionToken], (current) => {
        const next = data.hiredService;
        if (!current) return [next];
        return [next, ...current.filter((item) => item.id !== next.id)];
      });
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
      const hiredServices = await capability.listHiredServices(sessionToken, userId);
      return hiredServices.find((item) => hireId
        ? item.id === hireId
        : item.serviceId === serviceId && item.userId === userId && item.hiredAt === hiredAt) ?? null;
    },
  });
}

export function useHiredServices(sessionToken: string | null, userId: string | null) {
  const capability = useHireConfirmationCapability();
  return useQuery({
    queryKey: ["hired-services", sessionToken],
    enabled: Boolean(sessionToken) && Boolean(userId),
    queryFn: ({ signal }) => capability.listHiredServices(sessionToken ?? "", userId ?? "", signal),
  });
}

