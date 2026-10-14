import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle2, Target, Sparkles, ArrowRight, Compass } from "lucide-react";

interface ProgressStats {
  globalPercentage: number;
  totalCompleted: number;
  totalTasks: number;
  weeklyProgress: {
    weekNumber: number;
    weekTitle: string;
    completed: number;
    total: number;
    percentage: number;
  }[];
}

interface ProgressPanelProps {
  stats: ProgressStats;
}

export function ProgressPanel({ stats }: ProgressPanelProps) {
  const remaining = Math.max(0, stats.totalTasks - stats.totalCompleted);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (stats.globalPercentage || 0) / 100);

  return (
    <div className="space-y-5">
      {/* Apple-style Activity Ring Cockpit */}
      <Card className="glass-card rounded-3xl p-6 border border-border/70 shadow-sm relative overflow-hidden group">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Cockpit
              </span>
              <h3 className="text-foreground font-extrabold text-lg tracking-tight">
                Progression Globale
              </h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Circular Ring */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-muted/30"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke="url(#cockpitGradient)"
                  strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="cockpitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span
                  className="text-xl font-black text-foreground tracking-tight leading-none"
                  data-testid="text-global-percentage"
                >
                  {stats.globalPercentage}%
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Validé
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex-1 space-y-2">
              <div className="bg-muted/40 rounded-2xl p-2.5 border border-border/40">
                <p className="text-[11px] text-muted-foreground font-medium">Tâches validées</p>
                <p className="text-sm font-bold text-foreground">
                  {stats.totalCompleted} <span className="text-muted-foreground font-normal">/ {stats.totalTasks}</span>
                </p>
              </div>

              <div className="bg-muted/40 rounded-2xl p-2.5 border border-border/40">
                <p className="text-[11px] text-muted-foreground font-medium">Reste à faire</p>
                <p className="text-sm font-bold text-foreground">
                  {remaining} <span className="text-muted-foreground font-normal">étape{remaining > 1 ? "s" : ""}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Prochaine Action Recommandée */}
      <Card className="glass-card rounded-3xl p-5 border border-border/70 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Prochaine Étape
          </h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
          {stats.globalPercentage === 100
            ? "Félicitations ! Toutes les preuves et jalons sont validés. Votre mentor peut procéder à la revue finale."
            : remaining > 0
            ? "Consultez les objectifs de la semaine active et déposez votre capture d'écran pour valider la tâche."
            : "Continuez votre montée en compétences sur le projet."}
        </p>
      </Card>

      {/* Jalons Hebdomadaires (Compact Stepper) */}
      <Card className="glass-card rounded-3xl p-6 border border-border/70 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-foreground font-bold text-sm tracking-tight">
              Jalons par Semaine
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {stats.weeklyProgress.filter(w => w.percentage === 100).length}/{stats.weeklyProgress.length} finies
          </span>
        </div>

        <div className="space-y-2">
          {stats.weeklyProgress.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-4 font-medium">
              Aucun jalon hebdomadaire
            </p>
          ) : (
            stats.weeklyProgress.map((week) => (
              <div
                key={week.weekNumber}
                className="flex items-center justify-between p-2.5 rounded-xl bg-background/50 hover:bg-muted/40 transition-colors border border-border/30 gap-2"
                data-testid={`progress-week-${week.weekNumber}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      week.percentage === 100
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold"
                        : "bg-muted text-foreground/80"
                    }`}
                  >
                    S{week.weekNumber}
                  </div>
                  <span className="text-xs font-semibold text-foreground/90 truncate">
                    {week.weekTitle}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${week.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground/80 min-w-[28px] text-right">
                    {week.percentage}%
                  </span>
                  {week.percentage === 100 && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
