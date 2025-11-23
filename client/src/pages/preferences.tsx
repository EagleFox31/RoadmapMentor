import { useState, useEffect } from "react";
import { Check, Loader2, Sparkles, Bell, Zap, Users, Trophy, Mail, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PreferencesPage() {
  const [, setLocation] = useLocation();
  const [scrollY, setScrollY] = useState(0);
  const [preferences, setPreferences] = useState({
    taskReminders: true,
    weekPreparation: false,
    progressUpdates: true,
    commentNotifications: true,
    aiGenerationNotifications: true,
    weekValidationNotifications: true,
    newTaskNotifications: true,
    screenshotNotifications: false,
    weekModifiedNotifications: true,
    deadlineReminders: true,
    streakWarnings: true,
    milestoneNotifications: true,
    badgeNotifications: true,
    weeklyReports: true,
  });
  const [updating, setUpdating] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggle = (key: string) => {
    setUpdating(key);
    setSaveSuccess(false);

    setTimeout(() => {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
      setUpdating(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 400);
  };

  const categories = [
    {
      title: "Notifications de base",
      icon: Bell,
      gradient: "from-blue-500 to-cyan-500",
      items: [
        { key: "taskReminders", label: "Rappels de tâches", desc: "Recevez des rappels pour les tâches en attente" },
        { key: "weekPreparation", label: "Préparation de semaine", desc: "Rappels pour préparer les semaines à venir" },
        { key: "progressUpdates", label: "Mises à jour de progression", desc: "Notifications de complétion de tâches" },
        { key: "commentNotifications", label: "Commentaires", desc: "Alertes sur les nouveaux commentaires" },
      ]
    },
    {
      title: "IA & Système",
      icon: Sparkles,
      gradient: "from-purple-500 to-pink-500",
      items: [
        { key: "aiGenerationNotifications", label: "Génération IA", desc: "Succès ou échec de génération automatique" },
        { key: "weekValidationNotifications", label: "Validation de semaine", desc: "Notifications de validation mentor" },
      ]
    },
    {
      title: "Collaboration",
      icon: Users,
      gradient: "from-green-500 to-emerald-500",
      items: [
        { key: "newTaskNotifications", label: "Nouvelles tâches", desc: "Alertes pour les tâches assignées" },
        { key: "screenshotNotifications", label: "Screenshots", desc: "Notifications d'upload de captures" },
        { key: "weekModifiedNotifications", label: "Modifications", desc: "Changements dans les semaines" },
      ]
    },
    {
      title: "Rappels Intelligents",
      icon: Zap,
      gradient: "from-orange-500 to-red-500",
      items: [
        { key: "deadlineReminders", label: "Deadlines proches", desc: "Rappels 2 jours avant échéance" },
        { key: "streakWarnings", label: "Streak en danger", desc: "Maintenez votre rythme quotidien" },
      ]
    },
    {
      title: "Gamification",
      icon: Trophy,
      gradient: "from-yellow-500 to-amber-500",
      items: [
        { key: "milestoneNotifications", label: "Milestones", desc: "Célébrez vos jalons à 25%, 50%, 75%, 100%" },
        { key: "badgeNotifications", label: "Badges", desc: "Nouveaux badges débloqués" },
        { key: "weeklyReports", label: "Rapports hebdomadaires", desc: "Résumé de votre progression" },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '0s', animationDuration: '4s' }} />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '2s', animationDuration: '5s' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl animate-pulse" 
             style={{ animationDelay: '1s', animationDuration: '6s' }} />
      </div>

      {/* Top Bar - Sticky Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="container max-w-[1400px] mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Bouton de retour */}
            <button
              onClick={() => setLocation("/roadmap")}
              data-testid="button-back-roadmap"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 transition-all duration-200 shadow-sm hover:shadow-md group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 group-hover:text-slate-900 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Préférences de Notification
              </h1>
            </div>
          </div>
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600 animate-in fade-in slide-in-from-right-5 duration-300">
              <Check className="w-5 h-5" />
              <span className="font-medium">Sauvegardé</span>
            </div>
          )}
        </div>
      </div>

      <main className="container max-w-[1400px] mx-auto px-8 py-12 relative">
        {/* Hero Section */}
        <div className="mb-12 text-center" style={{ transform: `translateY(${scrollY * 0.1}px)` }}>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Personnalisez votre expérience de notification pour rester informé sans être submergé
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {categories.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div
                key={category.title}
                className="group relative"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
                }}
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-20 blur-2xl transition-all duration-500 rounded-3xl`} />

                {/* Card */}
                <div className="relative backdrop-blur-xl bg-white/80 rounded-3xl border border-slate-200 shadow-lg overflow-hidden transition-all duration-300 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/20">
                  {/* Header */}
                  <div className={`px-6 py-5 bg-gradient-to-br ${category.gradient} bg-opacity-10 border-b border-slate-200 flex items-center gap-3`}>
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${category.gradient} shadow-lg`}>
                      <Icon className="w-5 h-5 text-white drop-shadow-md" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">{category.title}</h2>
                  </div>

                  {/* Items */}
                  <div className="p-4 space-y-3">
                    {category.items.map((item) => (
                      <div
                        key={item.key}
                        className="group/item backdrop-blur-xl bg-white/90 rounded-2xl border border-slate-200 p-5 transition-all duration-300 hover:bg-blue-50 hover:border-blue-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                        onClick={() => handleToggle(item.key)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 mb-1 group-hover/item:text-blue-700 transition-colors">
                              {item.label}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 ${
                              preferences[item.key as keyof typeof preferences]
                                ? `bg-gradient-to-r ${category.gradient} shadow-lg`
                                : 'bg-slate-300'
                            }`}
                            disabled={updating === item.key}
                          >
                            {updating === item.key ? (
                              <Loader2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                            ) : (
                              <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-lg ${
                                  preferences[item.key as keyof typeof preferences]
                                    ? 'left-7'
                                    : 'left-1'
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

        {/* Info Card */}
        <div 
          className="mt-8 backdrop-blur-xl bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl border border-slate-200 shadow-lg p-8"
          style={{ animation: 'fadeInUp 0.6s ease-out 0.5s both' }}
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
            <Sparkles className="w-5 h-5 text-blue-600" />
            À propos de vos notifications
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Modifications instantanées et automatiques</span>
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
              <span>Contrôle total sur vos préférences</span>
            </div>
          </div>
        </div>
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