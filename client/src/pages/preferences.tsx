import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Bell, Zap, Users, Trophy, Mail, ArrowLeft, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmailNotificationPreferences } from "@shared/schema";

type PreferenceKey = Exclude<
  keyof EmailNotificationPreferences,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

type EditablePreferences = Pick<EmailNotificationPreferences, PreferenceKey>;

const PREFERENCE_KEYS: PreferenceKey[] = [
  "taskReminders",
  "weekPreparation",
  "progressUpdates",
  "commentNotifications",
  "aiGenerationNotifications",
  "weekValidationNotifications",
  "newTaskNotifications",
  "screenshotNotifications",
  "weekModifiedNotifications",
  "deadlineReminders",
  "streakWarnings",
  "milestoneNotifications",
  "badgeNotifications",
  "weeklyReports",
];

export default function PreferencesPage() {
  const [, setLocation] = useLocation();
  const [scrollY, setScrollY] = useState(0);
  const [updating, setUpdating] = useState<PreferenceKey | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    data: preferences,
    isLoading,
    isError,
    refetch,
  } = useQuery<EmailNotificationPreferences>({
    queryKey: ["/api/email-preferences"],
  });

  const updatePreference = useMutation<
    EmailNotificationPreferences,
    Error,
    { key: PreferenceKey; payload: EditablePreferences },
    { previous?: EmailNotificationPreferences }
  >({
    mutationFn: async ({ payload }) => {
      return await apiRequest("PUT", "/api/email-preferences", payload);
    },
    onMutate: async ({ key, payload }) => {
      setUpdating(key);
      setSaveSuccess(false);
      setSaveError(null);

      await queryClient.cancelQueries({ queryKey: ["/api/email-preferences"] });
      const previous = queryClient.getQueryData<EmailNotificationPreferences>([
        "/api/email-preferences",
      ]);

      if (previous) {
        queryClient.setQueryData<EmailNotificationPreferences>(
          ["/api/email-preferences"],
          { ...previous, ...payload },
        );
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/email-preferences"],
          context.previous,
        );
      }
      setSaveError(
        "La sauvegarde a échoué. La préférence précédente a été restaurée.",
      );
    },
    onSuccess: (savedPreferences) => {
      queryClient.setQueryData(
        ["/api/email-preferences"],
        savedPreferences,
      );
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 2000);
    },
    onSettled: () => {
      setUpdating(null);
    },
  });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggle = (key: PreferenceKey) => {
    if (!preferences || updatePreference.isPending) {
      return;
    }

    const nextValue = !preferences[key];
    const payload = Object.fromEntries(
      PREFERENCE_KEYS.map((preferenceKey) => [
        preferenceKey,
        preferenceKey === key ? nextValue : preferences[preferenceKey],
      ]),
    ) as EditablePreferences;

    updatePreference.mutate({ key, payload });
  };

  const categories: Array<{
    title: string;
    icon: typeof Bell;
    badgeStyle: string;
    items: Array<{ key: PreferenceKey; label: string; desc: string }>;
  }> = [
    {
      title: "Notifications de base",
      icon: Bell,
      badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      items: [
        { key: "taskReminders", label: "Rappels de tâches", desc: "Recevez des rappels pour les tâches en attente" },
        { key: "weekPreparation", label: "Préparation de semaine", desc: "Rappels pour préparer les semaines à venir" },
        { key: "progressUpdates", label: "Mises à jour de progression", desc: "Notifications de complétion de tâches" },
        { key: "commentNotifications", label: "Commentaires", desc: "Alertes sur les nouveaux commentaires" },
      ],
    },
    {
      title: "IA & Système",
      icon: Sparkles,
      badgeStyle: "bg-teal-50 text-teal-700 border-teal-200/60",
      items: [
        { key: "aiGenerationNotifications", label: "Génération IA", desc: "Succès ou échec de génération automatique" },
        { key: "weekValidationNotifications", label: "Validation de semaine", desc: "Notifications de validation mentor" },
      ],
    },
    {
      title: "Collaboration",
      icon: Users,
      badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
      items: [
        { key: "newTaskNotifications", label: "Nouvelles tâches", desc: "Alertes pour les tâches assignées" },
        { key: "screenshotNotifications", label: "Screenshots", desc: "Notifications d'upload de captures" },
        { key: "weekModifiedNotifications", label: "Modifications", desc: "Changements dans les semaines" },
      ],
    },
    {
      title: "Rappels Intelligents",
      icon: Zap,
      badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/60",
      items: [
        { key: "deadlineReminders", label: "Deadlines proches", desc: "Rappels 2 jours avant échéance" },
        { key: "streakWarnings", label: "Streak en danger", desc: "Maintenez votre rythme quotidien" },
      ],
    },
    {
      title: "Gamification",
      icon: Trophy,
      badgeStyle: "bg-purple-50 text-purple-700 border-purple-200/60",
      items: [
        { key: "milestoneNotifications", label: "Milestones", desc: "Célébrez vos jalons à 25%, 50%, 75%, 100%" },
        { key: "badgeNotifications", label: "Badges", desc: "Nouveaux badges débloqués" },
        { key: "weeklyReports", label: "Rapports hebdomadaires", desc: "Résumé de votre progression" },
      ],
    },
  ];

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
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Paramètres de notification & alertes</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Préférences de notification
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  Personnalisez votre expérience de notification pour rester informé de votre progression sans être submergé.
                </p>
              </div>
            </div>

            <div className="min-h-6 text-sm font-medium self-start sm:self-center">
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-full text-xs font-semibold animate-in fade-in duration-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Modifications enregistrées</span>
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200/80 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Chargement de vos préférences…</span>
          </div>
        )}

        {isError && (
          <div className="max-w-xl mx-auto rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-center backdrop-blur-xl">
            <AlertCircle className="w-7 h-7 text-rose-600 mx-auto mb-3" />
            <p className="text-sm text-rose-800 mb-4 font-medium">
              Impossible de charger vos préférences de notification.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              className="border-rose-200 text-rose-700 hover:bg-rose-100"
            >
              Réessayer
            </Button>
          </div>
        )}

        {!isLoading && !isError && preferences && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div
                    key={category.title}
                    className="rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xs overflow-hidden flex flex-col"
                  >
                    <div className="px-6 py-4 border-b border-slate-200/70 bg-slate-50/50 flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${category.badgeStyle}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        {category.title}
                      </h2>
                    </div>

                    <div className="p-4 space-y-2.5 flex-1">
                      {category.items.map((item) => (
                        <div
                          key={item.key}
                          className="group rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50/30 hover:border-emerald-200/60 p-4 transition-all flex items-center justify-between gap-4 cursor-pointer"
                          onClick={() => handleToggle(item.key)}
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">
                              {item.label}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-pressed={preferences[item.key]}
                            aria-label={`${item.label} : ${preferences[item.key] ? "activé" : "désactivé"}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggle(item.key);
                            }}
                            className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                              preferences[item.key]
                                ? "bg-emerald-600 shadow-xs"
                                : "bg-slate-300"
                            }`}
                            disabled={updatePreference.isPending}
                          >
                            {updating === item.key ? (
                              <Loader2 className="w-3.5 h-3.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                            ) : (
                              <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                                  preferences[item.key] ? "translate-x-7" : "translate-x-1"
                                }`}
                              />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>À propos de vos notifications</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Enregistrement instantané sur votre compte</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Notifications adaptées à votre rôle</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Envoyées à votre adresse email vérifiée</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Restauration automatique en cas d'erreur</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
