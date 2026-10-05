import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";

export type RoadmapSummary = { id: number; title: string; description: string | null };

const STORAGE_KEY = "active_roadmap_id";

function readStored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStored(id: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // stockage indisponible : la roadmap active reste portée par l'URL
  }
}

/**
 * Roadmap active : paramètre `?roadmap=` de l'URL, sinon dernière roadmap utilisée,
 * sinon première roadmap accessible. Un identifiant d'URL hors des roadmaps accessibles
 * n'est jamais substitué : `notFound` est alors vrai.
 */
export function useActiveRoadmap(basePath: string) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { data: roadmaps = [], isLoading } = useQuery<RoadmapSummary[]>({
    queryKey: ["/api/roadmaps"],
  });

  const fromUrl = Number(new URLSearchParams(search).get("roadmap"));
  const requestedId = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null;
  const stored = readStored();
  const fallback = roadmaps.find((roadmap) => roadmap.id === stored) ?? roadmaps[0] ?? null;

  const active =
    requestedId !== null
      ? roadmaps.find((roadmap) => roadmap.id === requestedId) ?? null
      : fallback;

  const setActiveId = (id: number) => {
    writeStored(id);
    setLocation(`${basePath}?roadmap=${id}`);
  };

  return {
    roadmaps,
    active,
    activeId: active?.id ?? null,
    setActiveId,
    isLoading,
    notFound: !isLoading && requestedId !== null && active === null,
  };
}
