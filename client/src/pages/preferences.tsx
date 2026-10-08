import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Bell, Zap, Users, Trophy, Mail, ArrowLeft, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
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
    gradient: string;
    items: Array<{ key: PreferenceKey; label: string; desc: string }>;
  }> = [
    {
      title: "Notifications de base",
      icon: Bell,
      gradient: "from-emerald-500 to-teal-500",
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
      gradient: "from-emerald-500 to-teal-500",
      items: [
        { key: "aiGenerationNotifications", label: "Génération IA", desc: "Succès ou échec de génération automatique" },
        { key: "weekValidationNotifications", label: "Validation de semaine", desc: "Notifications de validation mentor" },
      ],
    },
    {
      title: "Collaboration",
      icon: Users,
      gradient: "from-green-500 to-emerald-500",
      items: [
        { key: "newTaskNotifications", label: "Nouvelles tâches", desc: "Alertes pour les tâches assignées" },
        { key: "screenshotNotifications", label: "Screenshots", desc: "Notifications d'upload de captures" },
        { key: "weekModifiedNotifications", label: "Modifications", desc: "Changements dans les semaines" },
      ],
    },
    {
      title: "Rappels Intelligents",
      icon: Zap,
      gradient: "from-orange-500 to-red-500",
      items: [
        { key: "deadlineReminders", label: "Deadlines proches", desc: "Rappels 2 jours avant échéance" },
        { key: "streakWarnings", label: "Streak en danger", desc: "Maintenez votre rythme quotidien" },
      ],
    },
    {
      title: "Gamification",
      icon: Trophy,
      gradient: "from-yellow-500 to-amber-500",
      items: [
        { key: "milestoneNotifications", label: "Milestones", desc: "Célébrez vos jalons à 25%, 50%, 75%, 100%" },
        { key: "badgeNotifications", label: "Badges", desc: "Nouveaux badges débloqués" },
        { key: "weeklyReports", label: "Rapports hebdomadaires", desc: "Résumé de votre progression" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 -left-4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "0s", animationDuration: "4s" }}
        />
        <div
          className="absolute top-1/4 right-0 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s", animationDuration: "5s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s", animationDuration: "6s" }}
        />
      </div>

      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-neutral-200 shadow-sm">
        <div className="container max-w-[1400px] mx-auto px-8 py-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/roadmap")}
              data-testid="button-back-roadmap"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-200 hover:from-neutral-200 hover:to-neutral-300 transition-all duration-200 shadow-sm hover:shadow-md group"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-700 group-hover:text-neutral-900 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-emerald-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-600 bg-clip-text text-transparent">
                Préférences de Notification
              </h1>
            </div>
          </div>

          <div className="min-h-6 text-sm font-medium">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 animate-in fade-in slide-in-from-right-5 duration-300">
                <Check className="w-5 h-5" />
                <span>Sauvegardé</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span>{saveError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-[1400px] mx-auto px-8 py-12 relative">
        <div
          className="mb-12 text-center"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        >
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Personnalisez votre expérience de notification pour rester informé sans être submergé
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-20 text-neutral-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Chargement de vos préférences…</span>
          </div>
        )}

        {isError && (
          <div className="max-w-xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="w-7 h-7 text-red-600 mx-auto mb-3" />
            <p className="text-red-800 mb-4">
              Impossible de charger vos préférences de notification.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-white border border-red-200 text-red-700 font-medium hover:bg-red-100 transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && !isError && preferences && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categories.map((category, idx) => {
                const Icon = category.icon;
                return (
                  <div
                    key={category.title}
                    className="group relative"
                    style={{
                      animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`,
                    }}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-20 blur-2xl transition-all duration-500 rounded-3xl`}
                    />

                    <div className="relative backdrop-blur-xl bg-white/80 rounded-3xl border border-neutral-200 shadow-lg overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-500/20">
                      <div
                        className={`px-6 py-5 bg-gradient-to-br ${category.gradient} bg-opacity-10 border-b border-neutral-200 flex items-center gap-3`}
                      >
                        <div
                          className={`p-2.5 rounded-xl bg-gradient-to-br ${category.gradient} shadow-lg`}
                        >
                          <Icon className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-800">
                          {category.title}
                        </h2>
                      </div>

                      <div className="p-4 space-y-3">
                        {category.items.map((item) => (
                          <div
                            key={item.key}
                            className="group/item backdrop-blur-xl bg-white/90 rounded-2xl border border-neutral-200 p-5 transition-all duration-300 hover:bg-emerald-50 hover:border-emerald-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                            onClick={() => handleToggle(item.key)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-neutral-800 mb-1 group-hover/item:text-emerald-700 transition-colors">
                                  {item.label}
                                </h3>
                                <p className="text-sm text-neutral-600 leading-relaxed">
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
                                className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 ${
                                  preferences[item.key]
                                    ? `bg-gradient-to-r ${category.gradient} shadow-lg`
                                    : "bg-neutral-300"
                                }`}
                                disabled={updatePreference.isPending}
                              >
                                {updating === item.key ? (
                                  <Loader2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                                ) : (
                                  <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-lg ${
                                      preferences[item.key] ? "left-7" : "left-1"
                                    }`}
                                  />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="mt-8 backdrop-blur-xl bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-3xl border border-neutral-200 shadow-lg p-8"
              style={{ animation: "fadeInUp 0.6s ease-out 0.5s both" }}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-neutral-800">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                À propos de vos notifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-700">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Modifications enregistrées sur votre compte</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Notifications adaptées à votre rôle</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Envoyées à votre email principal</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Une erreur restaure automatiquement la valeur précédente</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
