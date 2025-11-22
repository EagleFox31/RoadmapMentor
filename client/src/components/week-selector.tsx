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
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-foreground mb-4">
        Semaines
      </h2>

      {weeks.length === 0 ? (
        <Card className="bg-card p-6 text-center rounded-xl shadow-sm">
          <p className="text-muted-foreground text-sm">Aucune semaine disponible</p>
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
                  ? "bg-card border-primary shadow-md ring-2 ring-primary ring-opacity-50" 
                  : "bg-card border-border shadow-sm hover:shadow-md"
                }
                rounded-xl p-4 group
              `}
              data-testid={`card-week-${week.id}`}
            >
              {/* Week number badge */}
              <div className="absolute -top-2 -left-2 w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-base">S{week.number}</span>
              </div>

              <div className="pl-12">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-foreground font-semibold text-sm leading-tight">
                    {week.title}
                  </h3>
                  {week.isValidatedByMentor && (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 ml-2" data-testid={`icon-validated-${week.id}`} />
                  )}
                </div>

                <p className="text-muted-foreground text-xs mb-3">
                  {week.startDate} - {week.endDate}
                </p>

                {/* Progress bar */}
                {progress.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{progress.completed}/{progress.total} tâches</span>
                      <span className="text-foreground font-medium">{progress.percentage}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all duration-300 rounded-full"
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
