import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentUser, isMentor, setCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

type SafeUser = Omit<UserType, "password">;

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mentor = isMentor();
  const sessionUser = getCurrentUser();

  const userQuery = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    initialData: sessionUser || undefined,
  });

  const currentUser: SafeUser | null = userQuery.data || sessionUser;

  // Form states
  const [fullName, setFullName] = useState(currentUser?.fullName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { fullName?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await apiRequest("PUT", "/api/auth/profile", payload);
      return (await res.json()) as SafeUser;
    },
    onSuccess: (updated: SafeUser) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setCurrentUser(updated);
      toast({
        title: "Profil mis à jour",
        description: "Vos modifications ont été enregistrées avec succès.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message.replace(/^\d{3}:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Nom requis", description: "Veuillez renseigner un nom complet.", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({ fullName: fullName.trim() });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast({ title: "Mot de passe requis", description: "Renseignez votre mot de passe actuel.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Mot de passe trop court", description: "Le nouveau mot de passe doit comporter au moins 8 caractères.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mots de passe non concordants", description: "Les mots de passe saisis ne sont pas identiques.", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({ currentPassword, newPassword });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const memberSince = currentUser?.createdAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(currentUser.createdAt))
    : "Récemment";

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
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mon Profil • Identité & Sécurité</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Mon Profil & Paramètres
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  Gérez votre identité, vos accès sécurisés et suivez votre statut andragogique.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Badge
                className={`${
                  mentor
                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                } px-3 py-1.5 text-xs font-bold rounded-xl`}
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${mentor ? "bg-indigo-500" : "bg-emerald-500 animate-pulse"}`} />
                <span>Rôle : {mentor ? "Mentor Référent" : "Apprenant ShopFlow"}</span>
              </Badge>
            </div>
          </div>
        </Card>

        {/* Grille principale */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Colonne gauche : Identité & Sécurité */}
          <div className="space-y-6">
            {/* 1. Informations Personnelles */}
            <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Informations personnelles
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Votre identité visible sur la plateforme et auprès de votre mentor.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveName} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                      Nom complet
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Votre nom complet"
                      className="rounded-xl border-slate-200 text-sm focus-visible:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                      Adresse e-mail
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        value={currentUser?.email || ""}
                        disabled
                        className="rounded-xl border-slate-200 bg-slate-50 text-slate-500 text-sm pl-9 cursor-not-allowed"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      L'adresse e-mail sert d'identifiant unique et de destination pour les alertes OTP.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending || fullName === currentUser?.fullName}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold px-4 py-2 flex items-center gap-2 shadow-xs transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Enregistrement…</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Enregistrer le nom</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 2. Sécurité & Mot de passe */}
            <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Sécurité & Mot de passe
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Modifiez votre mot de passe pour sécuriser l'accès à votre espace.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs font-semibold text-slate-700">
                      Mot de passe actuel
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="rounded-xl border-slate-200 text-sm pl-9 focus-visible:ring-emerald-500/20"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
                        Nouveau mot de passe
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 caractères"
                        className="rounded-xl border-slate-200 text-sm focus-visible:ring-emerald-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                        Confirmer le mot de passe
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Répétez le nouveau mot de passe"
                        className="rounded-xl border-slate-200 text-sm focus-visible:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending || !newPassword || !currentPassword}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold px-4 py-2 flex items-center gap-2 shadow-xs transition-colors"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mise à jour…</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Mettre à jour le mot de passe</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Encadré d'authentification OTP sans mot de passe */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">
                      Connexion sans mot de passe disponible
                    </h4>
                    <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                      Vous pouvez à tout moment vous connecter directement avec un code OTP à usage unique envoyé par email, sans avoir à mémoriser votre mot de passe.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite : Résumé & Navigation rapide */}
          <div className="space-y-6">
            {/* Carte Récapitulative Utilisateur */}
            <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 shadow-xs text-center space-y-4">
              <Avatar className="w-20 h-20 mx-auto border-2 border-emerald-200 shadow-md ring-4 ring-emerald-500/10">
                <AvatarFallback className="bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 text-white font-extrabold text-2xl">
                  {currentUser ? getInitials(currentUser.fullName) : "U"}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="text-lg font-bold text-slate-900">{currentUser?.fullName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{currentUser?.email}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Statut
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Actif</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Adhésion
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{memberSince}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Carte Accès Rapides */}
            <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Raccourcis & Centre d'Alertes
              </h4>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/notifications")}
                  className="w-full justify-start rounded-xl border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 py-2.5"
                >
                  <Clock className="w-4 h-4 mr-2.5 text-teal-600" />
                  <span>Historique des notifications</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setLocation("/preferences")}
                  className="w-full justify-start rounded-xl border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 py-2.5"
                >
                  <Mail className="w-4 h-4 mr-2.5 text-emerald-600" />
                  <span>Préférences d'alertes e-mail</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setLocation("/roadmap")}
                  className="w-full justify-start rounded-xl border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 py-2.5"
                >
                  <Compass className="w-4 h-4 mr-2.5 text-slate-500" />
                  <span>Ma feuille de route</span>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
