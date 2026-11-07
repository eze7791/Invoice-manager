import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Me = { id: string; name: string; email: string; emailConfigured: boolean };

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api.get<Me>("/me"), staleTime: 5 * 60_000 });
