import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, Sparkles } from "lucide-react";
import type { WeekWithDetails } from "@shared/schema";
import bgEmeraldNodes from "@assets/week-bg-emerald-nodes.webp";
import bgCodeMatrix from "@assets/week-bg-code-matrix.webp";
import bgDataMesh from "@assets/week-bg-data-mesh.webp";
import bgAiNeural from "@assets/week-bg-ai-neural.webp";

interface WeekSelectorProps {
  weeks: WeekWithDetails[];
  selectedWeekId: number | null;
  onSelectWeek: (weekId: number) => void;
  progressByWeek: Record<number, { completed: number; total: number; percentage: number }>;
}

const weekBackgrounds = [bgEmeraldNodes, bgCodeMatrix, bgDataMesh, bgAiNeural];

function formatHumanDateRange(startDateStr?: string, endDateStr?: string): string {
  if (!startDateStr || !endDateStr) return "";
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return `${startDateStr} — ${endDateStr}`;
    }
    const startFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
    const endFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    return `${startFormatter.format(start)} — ${endFormatter.format(end)}`;
  } catch {
    return `${startDateStr} — ${endDateStr}`;
  }
}

export function WeekSelector({ weeks, selectedWeekId, onSelectWeek, progressByWeek }: WeekSelectorProps) {
  return (
    <div className="space-y-3.5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Parcours
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            {weeks.length} semaine{weeks.length > 1 ? "s" : ""} au programme
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          Jalons
        </span>
      </div>

      {weeks.length === 0 ? (
        <Card className="glass-card p-6 text-center rounded-2xl">
          <p className="text-muted-foreground text-sm font-medium">Aucune semaine disponible</p>
        </Card>
      ) : (
        weeks.map((week) => {
          const progress = progressByWeek[week.id] || { completed: 0, total: 0, percentage: 0 };
          const isSelected = selectedWeekId === week.id;
          const backgroundImage = weekBackgrounds[(week.number - 1) % weekBackgrounds.length];
          const humanDates = formatHumanDateRange(week.startDate, week.endDate);

          return (
            <div
              key={week.id}
              onClick={() => onSelectWeek(week.id)}
              className={`
                relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 group
                ${isSelected 
                  ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/15 translate-x-1" 
                  : "hover:ring-1 hover:ring-border hover:shadow-md"
                }
              `}
              data-testid={`card-week-${week.id}`}
            >
              {/* Background image with subtle zoom */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: `url(${backgroundImage})` }}
              />
              {/* Refined gradient overlay for crisp readability */}
              <div className={`
                absolute inset-0 transition-colors duration-300
                ${isSelected
                  ? "bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-emerald-950/40"
                  : "bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-slate-900/40 group-hover:from-slate-950/85"
                }
              `} />

              {/* Active left glowing bar */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 shadow-sm" />
              )}

              <div className="relative z-10 p-4 pl-4.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`
                      inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold transition-transform
                      ${isSelected
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105"
                        : "bg-white/20 text-white backdrop-blur-md"
                      }
                    `}>
                      S{week.number}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {week.isValidatedByMentor && (
                      <CheckCircle2
                        className="w-5 h-5 text-emerald-400 drop-shadow flex-shrink-0"
                        data-testid={`icon-validated-${week.id}`}
                      />
                    )}
                    <span className="text-xs font-bold text-white/90">
                      {progress.percentage}%
                    </span>
                  </div>
                </div>

                <h3 className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow mb-1">
                  {week.title}
                </h3>

                {humanDates && (
                  <p className="text-white/70 text-[11px] font-medium flex items-center gap-1 mb-2.5 drop-shadow-sm">
                    <Calendar className="w-3 h-3 text-white/60" />
                    <span>{humanDates}</span>
                  </p>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        progress.percentage === 100
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                          : isSelected
                          ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                          : "bg-white/60"
                      }`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/60 font-medium">
                    <span>{progress.completed}/{progress.total} tâches</span>
                    {progress.percentage === 100 ? (
                      <span className="text-emerald-400 font-semibold">Complétée</span>
                    ) : (
                      <span>{progress.total - progress.completed} restante{progress.total - progress.completed > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
