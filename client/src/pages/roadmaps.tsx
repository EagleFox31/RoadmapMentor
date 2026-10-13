import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Compass,
  FolderKanban,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type RoadmapSummary = { id: number; title: string; description: string | null };

type Person = { id: number; fullName: string; email: string };

type MentorshipEntry = {
  id: number;
  roadmapId: number;
  mentorId: number;
  learnerId: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  mentor: Person | null;
  learner: Person | null;
};

type InvitationEntry = {
  id: number;
  email: string;
  state: "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
  sendCount: number;
};

const INVITATION_STATE_LABEL: Record<InvitationEntry["state"], string> = {
  PENDING: "En attente",
  EXPIRED: "Expirée",
  ACCEPTED: "Acceptée",
  REVOKED: "Révoquée",
};

const STATUS_LABEL: Record<MentorshipEntry["status"], string> = {
  ACTIVE: "Actif",
  PAUSED: "En pause",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^\d{3}:\s*/, "") : "Une erreur est survenue.";

export default function RoadmapsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mentor = isMentor();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roadmapForm, setRoadmapForm] = useState({ title: "", description: "" });
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Person | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const roadmaps = useQuery<RoadmapSummary[]>({ queryKey: ["/api/roadmaps"] });
  const mentorships = useQuery<MentorshipEntry[]>({ queryKey: ["/api/mentorships"] });

  const roadmapList = roadmaps.data ?? [];
  useEffect(() => {
    if (selectedId === null && roadmapList.length) setSelectedId(roadmapList[0].id);
  }, [selectedId, roadmapList]);

  const selected = roadmapList.find((roadmap) => roadmap.id === selectedId) ?? null;
  const selectedMentorships = (mentorships.data ?? []).filter((entry) => entry.roadmapId === selectedId);

  const createRoadmap = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/roadmaps", {
        title: roadmapForm.title.trim(),
        description: roadmapForm.description.trim() || null,
      }) as Promise<RoadmapSummary>,
    onSuccess: (roadmap) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmaps"] });
      setRoadmapForm({ title: "", description: "" });
      setSelectedId(roadmap.id);
      toast({ title: "Roadmap créée", description: roadmap.title });
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Création impossible", description: errorMessage(error) }),
  });

  const lookup = useMutation({
    mutationFn: () =>
      apiRequest("GET", "/api/learners/lookup?email=" + encodeURIComponent(email.trim())) as Promise<Person>,
    onMutate: () => {
      setFound(null);
      setLookupError(null);
    },
    onSuccess: setFound,
    onError: (error) =>
      setLookupError(
        /^404/.test(error instanceof Error ? error.message : "")
          ? "Aucun apprenant inscrit avec cet e-mail."
          : errorMessage(error),
      ),
  });

  const attach = useMutation({
    mutationFn: (learnerId: number) =>
      apiRequest("POST", `/api/roadmaps/${selectedId}/mentorships`, { learnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentorships"] });
      toast({ title: "Apprenant rattaché", description: `${found?.fullName} voit désormais cette roadmap.` });
      setFound(null);
      setEmail("");
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Rattachement impossible", description: errorMessage(error) }),
  });

  const invitationsKey = ["/api/roadmaps", selectedId, "invitations"];
  const invitations = useQuery<InvitationEntry[]>({
    queryKey: invitationsKey,
    queryFn: () => apiRequest("GET", `/api/roadmaps/${selectedId}/invitations`),
    enabled: mentor && selectedId !== null,
  });

  const invite = useMutation({
    mutationFn: () => apiRequest("POST", `/api/roadmaps/${selectedId}/invitations`, { email: email.trim() }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: invitationsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/mentorships"] });
      if (result.outcome === "attached") {
        toast({ title: "Apprenant rattaché", description: "Ce compte existait déjà." });
      } else if (result.emailSent) {
        toast({ title: "Invitation envoyée", description: email.trim() });
      } else {
        toast({
          variant: "destructive",
          title: "Invitation créée, e-mail non envoyé",
          description: "Utilisez « Renvoyer » une fois l’envoi d’e-mails disponible.",
        });
      }
      setEmail("");
      setLookupError(null);
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Invitation impossible", description: errorMessage(error) }),
  });

  const resend = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/invitations/${id}/resend`),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: invitationsKey });
      toast(
        result.emailSent
          ? { title: "Invitation renvoyée" }
          : { variant: "destructive", title: "E-mail non envoyé", description: "Réessayez plus tard." },
      );
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Renvoi impossible", description: errorMessage(error) }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/invitations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKey });
      toast({ title: "Invitation révoquée" });
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Révocation impossible", description: errorMessage(error) }),
  });

  const alreadyAttached = found
    ? selectedMentorships.some((entry) => entry.learnerId === found.id)
    : false;

  const loading = roadmaps.isLoading || mentorships.isLoading;
  const failed = roadmaps.error || mentorships.error;

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
                  <FolderKanban className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{mentor ? "Espace Mentor • Supervision des feuilles de route" : "Espace Apprenant • Parcours rattachés"}</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {mentor ? "Roadmaps & Apprenants" : "Mes Feuilles de Route"}
                </h1>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                  {mentor
                    ? "Gérez vos programmes andragogiques, supervisez les apprenants rattachés et envoyez de nouvelles invitations."
                    : "Retrouvez l'ensemble des parcours andragogiques auxquels vous êtes rattaché."}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500 text-sm" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span>Chargement de vos roadmaps…</span>
          </div>
        )}

        {failed && !loading && (
          <Card className="max-w-xl mx-auto rounded-3xl border-rose-200 bg-rose-50/70 p-6 text-center backdrop-blur-xl shadow-xs">
            <XCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
            <CardTitle className="text-base text-rose-900 mb-1">Impossible de charger vos roadmaps</CardTitle>
            <CardDescription className="text-xs text-rose-700 mb-4">{errorMessage(failed)}</CardDescription>
            <Button
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl"
              onClick={() => {
                roadmaps.refetch();
                mentorships.refetch();
              }}
            >
              Réessayer
            </Button>
          </Card>
        )}

        {!loading && !failed && (
          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            {/* Colonne Gauche : Liste des roadmaps & Création */}
            <section className="space-y-6" aria-label="Roadmaps">
              {/* Carte Liste */}
              <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <Compass className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Feuilles de route
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600">
                    {roadmapList.length}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {roadmapList.length === 0 ? (
                    <div
                      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-2"
                      data-testid="roadmaps-empty"
                    >
                      <Compass className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {mentor
                          ? "Vous n’avez pas encore de roadmap. Créez votre première ci-dessous."
                          : "Aucune roadmap ne vous est rattachée pour le moment. Demandez à votre mentor de vous inviter avec votre e-mail d’inscription."}
                      </p>
                    </div>
                  ) : (
                    roadmapList.map((roadmap) => (
                      <button
                        key={roadmap.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(roadmap.id);
                          setFound(null);
                          setLookupError(null);
                        }}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          roadmap.id === selectedId
                            ? "border-emerald-500/60 bg-emerald-50/90 text-emerald-950 shadow-xs ring-2 ring-emerald-500/10"
                            : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700 shadow-2xs"
                        }`}
                        data-testid={`roadmap-item-${roadmap.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-slate-900 leading-snug">{roadmap.title}</h3>
                          {roadmap.id === selectedId && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-2 py-0.5 shrink-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        {roadmap.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                            {roadmap.description}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Formulaire Mentor : Créer une roadmap */}
              {mentor && (
                <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60">
                        <Plus className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Nouvelle feuille de route
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      Définissez un nouveau parcours andragogique pour vos apprenants.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (roadmapForm.title.trim()) createRoadmap.mutate();
                      }}
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Titre de la roadmap</label>
                        <Input
                          placeholder="Ex : Backend Python & FastAPI ShopFlow"
                          value={roadmapForm.title}
                          onChange={(event) => setRoadmapForm({ ...roadmapForm, title: event.target.value })}
                          data-testid="input-roadmap-title"
                          className="bg-slate-50/50 border-slate-200 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Description</label>
                        <Textarea
                          placeholder="Objectifs andragogiques, prérequis et livrables attendus…"
                          value={roadmapForm.description}
                          onChange={(event) => setRoadmapForm({ ...roadmapForm, description: event.target.value })}
                          className="bg-slate-50/50 border-slate-200 rounded-xl resize-none min-h-[80px]"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={!roadmapForm.title.trim() || createRoadmap.isPending}
                        data-testid="button-create-roadmap"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs"
                      >
                        {createRoadmap.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        <span>Créer la feuille de route</span>
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Colonne Droite : Détail & Accompagnements rattachés */}
            <section className="space-y-6" aria-label="Mentorats">
              {!selected ? (
                <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 backdrop-blur-xl p-12 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                    <Compass className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mb-1">
                    Sélectionnez une feuille de route
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Choisissez une roadmap dans la colonne de gauche pour superviser les apprenants rattachés, gérer les invitations et accéder au suivi andragogique.
                  </p>
                </Card>
              ) : (
                <>
                  {/* Carte En-tête de la Roadmap sélectionnée */}
                  <Card className="rounded-3xl border-emerald-200/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white/90 backdrop-blur-xl p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Feuille de route sélectionnée
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                          {selected.title}
                        </h2>
                        {selected.description && (
                          <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                            {selected.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => setLocation("/roadmap")}
                          className="rounded-xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                        >
                          <Compass className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span>Voir le parcours</span>
                        </Button>
                        <Button
                          onClick={() => setLocation("/mentoring")}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                        >
                          <BriefcaseBusiness className="w-3.5 h-3.5 mr-1.5" />
                          <span>Mentorat & scope</span>
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Carte Apprenants rattachés */}
                  <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                    <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">
                            {mentor ? "Apprenants rattachés" : "Mon accompagnement"}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            {mentor
                              ? "Liste des adultes en formation active sur cette feuille de route."
                              : "Statut de votre mentorat sur ce parcours."}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600">
                        {selectedMentorships.length}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      {selectedMentorships.length === 0 ? (
                        <div
                          className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-2"
                          data-testid="mentorships-empty"
                        >
                          <Users className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="text-sm font-semibold text-slate-700">
                            {mentor
                              ? "Aucun apprenant rattaché à cette roadmap."
                              : "Aucun mentorat actif sur cette roadmap."}
                          </p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            {mentor
                              ? "Utilisez le formulaire ci-dessous pour rechercher un compte existant ou envoyer une invitation par e-mail."
                              : "Votre mentor doit vous associer à ce parcours pour que vos jalons soient synchronisés."}
                          </p>
                        </div>
                      ) : (
                        selectedMentorships.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/30 hover:border-emerald-200/60 p-4 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10 border border-slate-200 shadow-2xs">
                                <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-xs">
                                  {entry.learner?.fullName ? entry.learner.fullName.slice(0, 2).toUpperCase() : "AP"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-bold text-sm text-slate-900">
                                  {entry.learner?.fullName ?? "Apprenant"}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>{entry.learner?.email}</span>
                                  <span>•</span>
                                  <span>Mentor : {entry.mentor?.fullName ?? "Non assigné"}</span>
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={`text-xs font-semibold px-2.5 py-1 ${
                                entry.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : entry.status === "PAUSED"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              } border`}
                            >
                              {STATUS_LABEL[entry.status]}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Carte Formulaire Rattachement (Mentor) */}
                  {mentor && (
                    <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden">
                      <CardHeader className="p-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <UserPlus className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold text-slate-900">
                              Rattacher ou inviter un apprenant
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">
                              Recherchez un utilisateur inscrit par son adresse e-mail ou expédiez une invitation sécurisée.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <form
                          className="space-y-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (email.trim()) lookup.mutate();
                          }}
                        >
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                              type="email"
                              placeholder="Ex : apprenant@exemple.com"
                              value={email}
                              onChange={(event) => {
                                setEmail(event.target.value);
                                setFound(null);
                                setLookupError(null);
                              }}
                              data-testid="input-learner-email"
                              className="bg-slate-50/50 border-slate-200 rounded-xl flex-1"
                            />
                            <Button
                              type="submit"
                              variant="outline"
                              disabled={!email.trim() || lookup.isPending}
                              data-testid="button-lookup-learner"
                              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0 font-semibold"
                            >
                              {lookup.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                              <span className="ml-2">Rechercher</span>
                            </Button>
                          </div>

                          {lookupError && (
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                              <p className="font-medium" role="alert">
                                {lookupError}
                              </p>
                              {/^Aucun apprenant/.test(lookupError) && (
                                <Button
                                  type="button"
                                  disabled={invite.isPending}
                                  onClick={() => invite.mutate()}
                                  data-testid="button-invite-learner"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs"
                                >
                                  {invite.isPending ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="mr-2 h-3.5 w-3.5" />
                                  )}
                                  <span>Inviter par e-mail</span>
                                </Button>
                              )}
                            </div>
                          )}

                          {found && (
                            <div
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
                              data-testid="learner-found"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                                  <UserCheck className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-900">{found.fullName}</div>
                                  <div className="text-xs text-slate-600">{found.email}</div>
                                </div>
                              </div>
                              {alreadyAttached ? (
                                <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                                  Déjà rattaché à cette roadmap
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  disabled={attach.isPending}
                                  onClick={() => attach.mutate(found.id)}
                                  data-testid="button-attach-learner"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs"
                                >
                                  {attach.isPending ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                                  )}
                                  <span>Confirmer le rattachement</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Carte Liste des invitations en attente */}
                  {mentor && (invitations.data ?? []).length > 0 && (
                    <Card className="rounded-3xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xs overflow-hidden" data-testid="invitations-list">
                      <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold text-slate-900">
                              Invitations envoyées
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">
                              Suivi des e-mails d'invitation avec jeton sécurisé.
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs font-semibold bg-slate-50 border-slate-200 text-slate-600">
                          {(invitations.data ?? []).length}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-6 space-y-3">
                        {(invitations.data ?? []).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                            data-testid={`invitation-${entry.id}`}
                          >
                            <div>
                              <div className="font-bold text-sm text-slate-900">{entry.email}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold">
                                  {INVITATION_STATE_LABEL[entry.state]}
                                </Badge>
                                {entry.state === "PENDING" && (
                                  <span>• Expire le {new Date(entry.expiresAt).toLocaleDateString("fr-FR")}</span>
                                )}
                              </div>
                            </div>
                            {entry.state === "PENDING" && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resend.isPending}
                                  onClick={() => resend.mutate(entry.id)}
                                  data-testid={`button-resend-${entry.id}`}
                                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${resend.isPending ? "animate-spin" : ""}`} />
                                  <span>Renvoyer</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={revoke.isPending}
                                  onClick={() => revoke.mutate(entry.id)}
                                  data-testid={`button-revoke-${entry.id}`}
                                  className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  <span>Révoquer</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
