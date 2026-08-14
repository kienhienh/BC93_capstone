import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfileCapability } from "./context";
import type { EditableProfile, Profile } from "./capability";
import { ProfileFailure } from "./capability";

export const profileKey = (id: string) => ["profile", id] as const;
export function useCurrentProfile(userId: string, token: string) {
  const capability = useProfileCapability();
  return useQuery({ queryKey: profileKey(userId), queryFn: ({ signal }) => capability.getProfile(userId, token, signal) });
}
export function useSaveProfile(userId: string, token: string) {
  const capability = useProfileCapability(); const client = useQueryClient();
  return useMutation({ mutationFn: async ({ profile, changes }: { profile: Profile; changes: EditableProfile }) => {
    const latest = await capability.getProfile(userId, token);
    if (JSON.stringify(latest) !== JSON.stringify(profile)) throw new ProfileFailure("stale");
    return capability.updateProfile(latest, changes, token);
  }, onSuccess: (profile) => client.setQueryData(profileKey(userId), profile) });
}
export function useUploadAvatar(userId: string, token: string) {
  const capability = useProfileCapability(); const client = useQueryClient();
  return useMutation({ mutationFn: (file: File) => capability.uploadAvatar(userId, file, token), onSuccess: (profile) => client.setQueryData(profileKey(userId), profile) });
}
