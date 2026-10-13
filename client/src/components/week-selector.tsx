import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import type { WeekWithDetails } from "@shared/schema";
import bgEmeraldNodes from "@assets/week-bg-emerald-nodes.jpg";
import bgCodeMatrix from "@assets/week-bg-code-matrix.jpg";
import bgDataMesh from "@assets/week-bg-data-mesh.jpg";
import bgAiNeural from "@assets/week-bg-ai-neural.jpg";

interface WeekSelectorProps {
  weeks: WeekWithDetails[];
  selectedWeekId: number | null;
  onSelectWeek: (weekId: number) => void;
  progressByWeek: Record<number, { completed: number; total: number; percentage: number }>;
}

// Alternate high-tech developer backgrounds between weeks
const weekBackgrounds = [bgEmeraldNodes, bgCodeMatrix, bgDataMesh, bgAiNeural];

export function WeekSelector({ weeks, selectedWeekId, onSelectWeek, progressByWeek }: WeekSelectorProps) {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold gradient-text mb-6">
        Semaines
      </h2>

      {weeks.length === 0 ? (
        <Card className="glass-card p-8 text-center rounded-2xl">
          <p className="text-muted-foreground text-sm font-medium">Aucune semaine disponible</p>
        </Card>
      ) : (
        weeks.map((week) => {
          const progress = progressByWeek[week.id] || { completed: 0, total: 0, percentage: 0 };
          const isSelected = selectedWeekId === week.id;
          const backgroundImage = weekBackgrounds[(week.number - 1) % weekBackgrounds.length];

          return (
            <div
              key={week.id}
              className="relative rounded-2xl overflow-hidden group shadow-md transition-all duration-300"
            >
              {/* Image d'arrière-plan haute définition avec zoom subtil au survol */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{
                  backgroundImage: `url(${backgroundImage})`,
                }}
              />
              {/* Voile sombre pour un contraste et une lisibilité parfaits du texte */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/65 to-slate-900/45 backdrop-blur-[1px]" />
              
              <Card
                onClick={() => onSelectWeek(week.id)}
                className={`
                  relative cursor-pointer transition-all duration-300 bg-transparent
                  ${isSelected 
                    ? "border-emerald-500/70 shadow-lg ring-2 ring-emerald-500/30" 
                    : "border-white/10 hover:border-emerald-500/30 shadow-md"
                  }
                  rounded-2xl p-5
                `}
                data-testid={`card-week-${week.id}`}
              >
              
              {/* Week number badge */}
              <div className="relative z-10 absolute -top-3 -left-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl pulse-glow transition-all duration-300">
                <span className="text-white font-bold text-lg">S{week.number}</span>
              </div>

              <div className="relative z-10 pl-14">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-bold text-base leading-tight drop-shadow-lg">
                    {week.title}
                  </h3>
                  {week.isValidatedByMentor && (
                    <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0 ml-2 drop-shadow-lg icon-hover" data-testid={`icon-validated-${week.id}`} />
                  )}
                </div>

                <p className="text-white/80 text-xs font-medium mb-4 drop-shadow">
                  {week.startDate} - {week.endDate}
                </p>

                {/* Progress bar */}
                {progress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white/70 drop-shadow">{progress.completed}/{progress.total} tâches</span>
                      <span className="text-white drop-shadow">{progress.percentage}%</span>
                    </div>
                    <div className="h-2.5 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                      <div
                        className="h-full bg-gradient-to-r from-success to-teal-500 transition-all duration-500 rounded-full shadow-lg"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
