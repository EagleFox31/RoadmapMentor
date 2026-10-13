import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NotificationEntry = {
  id: number;
  userId: number;
  type: string;
  subject: string;
  recipientEmail: string;
  sentAt: string;
  status: string;
  errorMessage: string | null;
};

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<string>("ALL");

  const {
    data: notifications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<NotificationEntry[]>({
    queryKey: ["/api/notifications"],
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TASK_REMINDER":
      case "DEADLINE_APPROACHING":
        return <Clock className="w-4 h-4 text-amber-600" />;
      case "PROGRESS_UPDATE":
      case "WEEK_VALIDATION":
      case "MILESTONE_REACHED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "COMMENT_NOTIFICATION":
      case "NEW_TASK_ASSIGNED":
        return <Send className="w-4 h-4 text-indigo-600" />;
      case "AI_GENERATION_SUCCESS":
      case "AI_GENERATION_FAILURE":
        return <Sparkles className="w-4 h-4 text-teal-600" />;
      case "BADGE_UNLOCKED":
        return <Award className="w-4 h-4 text-purple-600" />;
      default:
        return <Mail className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "TASK_REMINDER":
        return "Rappel de tâche";
      case "WEEK_PREPARATION":
        return "Préparation de semaine";
      case "PROGRESS_UPDATE":
        return "Progression";
      case "COMMENT_NOTIFICATION":
        return "Nouveau commentaire";
      case "WEEK_VALIDATION":
        return "Validation mentor";
      case "AI_GENERATION_SUCCESS":
        return "Génération IA";
      case "DEADLINE_APPROACHING":
        return "Échéance proche";
      case "MILESTONE_REACHED":
        return "Jalon atteint";
      case "BADGE_UNLOCKED":
        return "Badge débloqué";
      default:
        return "Notification";
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "TASKS") return item.type.includes("TASK") || item.type.includes("DEADLINE");
    if (filter === "PROGRESS") return item.type.includes("PROGRESS") || item.type.includes("VALIDATION") || item.type.includes("MILESTONE");
    if (filter === "SYSTEM") return item.type.includes("AI") || item.type.includes("REPORT");
    return true;
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col relative overflow-hidden">
      <TopBar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 pt-24 sm:pt-28 relative z-10 flex-1">
        {/* Carte En-tête Unifiée */}
        <Card className="mb-6 rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/roadmap")}
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold px-3 py-1.5 h-auto transition-colors"
                  data-testid="button-back-roadmap"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour à la feuille de route
                </Button>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Centre de Notifications • Flux d'Activité</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Notifications & Activités
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  Consultez l'historique de vos alertes, rappels de jalons et notifications andragogiques.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${isRefetching ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              <Button
                size="sm"
                onClick={() => setLocation("/preferences")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Gérer les alertes</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Barre de filtres contextuels */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "ALL"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Toutes ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("TASKS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "TASKS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Rappels de tâches
          </button>
          <button
            type="button"
            onClick={() => setFilter("PROGRESS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "PROGRESS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Jalons & Progression
          </button>
          <button
            type="button"
            onClick={() => setFilter("SYSTEM")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === "SYSTEM"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            IA & Système
          </button>
        </div>

        {/* État de chargement */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Récupération de vos notifications…</span>
          </div>
        )}

        {/* Liste des notifications ou Empty State */}
        {!isLoading && filteredNotifications.length === 0 ? (
          <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-8 sm:p-12 shadow-xs text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Inbox className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">
                Vous êtes à jour !
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                Aucune nouvelle notification pour le moment. Vos rappels de jalons ShopFlow, retours de mentorat et alertes d'avancement apparaîtront ici.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => setLocation("/roadmap")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs px-4 py-2 flex items-center gap-2 shadow-xs"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Continuer ma feuille de route</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/preferences")}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Configurer les alertes e-mail</span>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <Card
                key={notif.id}
                className="rounded-2xl border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 border-slate-200 text-slate-600"
                        >
                          {getTypeLabel(notif.type)}
                        </Badge>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(notif.sentAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {notif.subject}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Envoyé à : {notif.recipientEmail}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Badge
                      className={`${
                        notif.status === "sent"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      } text-[10px] font-semibold border`}
                    >
                      {notif.status === "sent" ? "Délivré" : notif.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
