import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RoadmapSummary } from "@/lib/active-roadmap";

interface RoadmapSwitcherProps {
  roadmaps: RoadmapSummary[];
  activeId: number | null;
  onChange: (id: number) => void;
}

export function RoadmapSwitcher({ roadmaps, activeId, onChange }: RoadmapSwitcherProps) {
  if (roadmaps.length <= 1) {
    return roadmaps[0] ? (
      <p className="px-2 font-semibold text-foreground truncate" data-testid="text-active-roadmap">
        {roadmaps[0].title}
      </p>
    ) : null;
  }

  return (
    <Select value={activeId ? String(activeId) : undefined} onValueChange={(value) => onChange(Number(value))}>
      <SelectTrigger className="w-full rounded-2xl glass-card" data-testid="select-active-roadmap">
        <SelectValue placeholder="Choisir une roadmap" />
      </SelectTrigger>
      <SelectContent>
        {roadmaps.map((roadmap) => (
          <SelectItem key={roadmap.id} value={String(roadmap.id)}>
            {roadmap.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
