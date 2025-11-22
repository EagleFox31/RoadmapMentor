import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import type { WeekWithDetails } from "@shared/schema";
import dashboardBg from "@assets/istockphoto-640026090-612x612_1763816587120.jpg";
import progressBg from "@assets/istockphoto-1465286638-612x612_1763816587123.jpg";

interface WeekSelectorProps {
  weeks: WeekWithDetails[];
  selectedWeekId: number | null;
  onSelectWeek: (weekId: number) => void;
  progressByWeek: Record<number, { completed: number; total: number; percentage: number }>;
}

// Alternate backgrounds between weeks
const weekBackgrounds = [dashboardBg, progressBg];

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
            <Card
              key={week.id}
              onClick={() => onSelectWeek(week.id)}
              className={`
                relative cursor-pointer transition-all duration-400 hover-elevate parallax-sm overflow-hidden
                ${isSelected 
                  ? "glass-card border-primary/50 shadow-lg ring-2 ring-primary/20 glow" 
                  : "glass border-white/10 shadow-md glow-on-hover"
                }
                rounded-2xl p-5 group
              `}
              style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              data-testid={`card-week-${week.id}`}
            >
              {/* Dark overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70 rounded-2xl" />
              
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
                        className="h-full bg-gradient-to-r from-success to-cyan-500 transition-all duration-500 rounded-full shadow-lg"
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
