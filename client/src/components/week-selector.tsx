import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import type { WeekWithDetails } from "@shared/schema";

interface WeekSelectorProps {
  weeks: WeekWithDetails[];
  selectedWeekId: number | null;
  onSelectWeek: (weekId: number) => void;
  progressByWeek: Record<number, { completed: number; total: number; percentage: number }>;
}

export function WeekSelector({ weeks, selectedWeekId, onSelectWeek, progressByWeek }: WeekSelectorProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-4 px-2">
        Semaines
      </h2>

      {weeks.length === 0 ? (
        <Card className="bg-white/5 backdrop-blur-xl border border-white/20 p-6 text-center rounded-2xl">
          <p className="text-white/60 text-sm">Aucune semaine disponible</p>
        </Card>
      ) : (
        weeks.map((week) => {
          const progress = progressByWeek[week.id] || { completed: 0, total: 0, percentage: 0 };
          const isSelected = selectedWeekId === week.id;

          return (
            <Card
              key={week.id}
              onClick={() => onSelectWeek(week.id)}
              className={`
                relative cursor-pointer transition-all duration-200
                ${isSelected 
                  ? "bg-white/20 border-white/40 shadow-2xl scale-105" 
                  : "bg-white/10 border-white/20 shadow-xl hover:bg-white/15 hover:-translate-y-1 hover:shadow-2xl"
                }
                backdrop-blur-xl rounded-2xl p-4 group
              `}
              data-testid={`card-week-${week.id}`}
            >
              {/* Week number badge */}
              <div className="absolute -top-3 -left-3 w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-white font-bold text-lg">S{week.number}</span>
              </div>

              <div className="pl-12">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold text-sm leading-tight">
                    {week.title}
                  </h3>
                  {week.isValidatedByMentor && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 ml-2" data-testid={`icon-validated-${week.id}`} />
                  )}
                </div>

                <p className="text-white/60 text-xs mb-3">
                  {week.startDate} - {week.endDate}
                </p>

                {/* Progress bar */}
                {progress.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">{progress.completed}/{progress.total} tâches</span>
                      <span className="text-white font-semibold">{progress.percentage}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300 rounded-full"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
