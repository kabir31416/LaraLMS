import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { PublicInstitutionInfo } from "@/types/academic";

/**
 * Public, no-login branding (name, logo, address, phone, website) from the
 * same /public/institution endpoint PublicInfo/Marksheet already use —
 * cached once for the homepage and every login page.
 */
export function usePublicInstitution(): PublicInstitutionInfo | null {
  const q = useQuery({
    queryKey: ["public", "institution"],
    queryFn: () => api.get<PublicInstitutionInfo>("/public/institution"),
    staleTime: 10 * 60_000,
    retry: false,
  });
  return q.data ?? null;
}
