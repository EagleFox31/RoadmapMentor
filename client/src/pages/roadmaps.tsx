import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mail, Plus, Search, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen w-full bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-28">
        <Button variant="ghost" onClick={() => setLocation("/roadmap")} className="mb-4 text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la roadmap
        </Button>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          {mentor ? "Roadmaps et apprenants" : "Mes roadmaps"}
        </h1>
        <p className="mb-8 text-muted-foreground">
          {mentor
            ? "Créez une roadmap, puis rattachez-y un apprenant déjà inscrit."
            : "Les roadmaps auxquelles votre mentor vous a rattaché."}
        </p>

        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        )}

        {failed && !loading && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-200" role="alert">
            Impossible de charger vos roadmaps. {errorMessage(failed)}
            <Button
              variant="outline"
              className="ml-4"
              onClick={() => {
                roadmaps.refetch();
                mentorships.refetch();
              }}
            >
              Réessayer
            </Button>
          </div>
        )}

        {!loading && !failed && (
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <section className="space-y-4" aria-label="Roadmaps">
              {roadmapList.length === 0 && (
                <div
                  className="rounded-2xl border border bg-muted/40 p-6 text-muted-foreground"
                  data-testid="roadmaps-empty"
                >
                  {mentor
                    ? "Vous n’avez pas encore de roadmap. Créez la première ci-dessous."
                    : "Aucune roadmap ne vous est rattachée pour le moment. Demandez à votre mentor de vous inviter avec votre e-mail d’inscription."}
                </div>
              )}
              {roadmapList.map((roadmap) => (
                <button
                  key={roadmap.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(roadmap.id);
                    setFound(null);
                    setLookupError(null);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    roadmap.id === selectedId
                      ? "border-primary/60 bg-primary/10"
                      : "border bg-muted/40 hover:border-foreground/30"
                  }`}
                  data-testid={`roadmap-item-${roadmap.id}`}
                >
                  <div className="font-semibold text-foreground">{roadmap.title}</div>
                  {roadmap.description && (
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{roadmap.description}</div>
                  )}
                </button>
              ))}

              {mentor && (
                <form
                  className="space-y-3 rounded-2xl border border bg-muted/40 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (roadmapForm.title.trim()) createRoadmap.mutate();
                  }}
                >
                  <h2 className="font-semibold text-foreground">Nouvelle roadmap</h2>
                  <Input
                    placeholder="Titre"
                    value={roadmapForm.title}
                    onChange={(event) => setRoadmapForm({ ...roadmapForm, title: event.target.value })}
                    data-testid="input-roadmap-title"
                  />
                  <Textarea
                    placeholder="Description (optionnelle)"
                    value={roadmapForm.description}
                    onChange={(event) => setRoadmapForm({ ...roadmapForm, description: event.target.value })}
                  />
                  <Button
                    type="submit"
                    disabled={!roadmapForm.title.trim() || createRoadmap.isPending}
                    data-testid="button-create-roadmap"
                  >
                    {createRoadmap.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Créer
                  </Button>
                </form>
              )}
            </section>

            <section className="space-y-6" aria-label="Mentorats">
              {!selected ? (
                <div className="rounded-2xl border border bg-muted/40 p-8 text-muted-foreground">
                  Sélectionnez une roadmap.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-foreground">{selected.title}</h2>
                    <Button variant="outline" size="sm" onClick={() => setLocation("/mentoring")}>
                      Mentorat et scope
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedMentorships.length === 0 ? (
                      <div
                        className="rounded-2xl border border bg-muted/40 p-6 text-muted-foreground"
                        data-testid="mentorships-empty"
                      >
                        {mentor
                          ? "Aucun apprenant rattaché à cette roadmap."
                          : "Aucun mentorat actif sur cette roadmap."}
                      </div>
                    ) : (
                      selectedMentorships.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border bg-muted/40 p-4"
                        >
                          <div>
                            <div className="font-medium text-foreground">
                              {entry.learner?.fullName ?? "Apprenant"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {entry.learner?.email} · mentor : {entry.mentor?.fullName ?? "—"}
                            </div>
                          </div>
                          <Badge variant="outline">{STATUS_LABEL[entry.status]}</Badge>
                        </div>
                      ))
                    )}
                  </div>

                  {mentor && (
                    <form
                      className="space-y-3 rounded-2xl border border bg-muted/40 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (email.trim()) lookup.mutate();
                      }}
                    >
                      <h3 className="font-semibold text-foreground">Rattacher un apprenant</h3>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="E-mail d’inscription de l’apprenant"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setFound(null);
                            setLookupError(null);
                          }}
                          data-testid="input-learner-email"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={!email.trim() || lookup.isPending}
                          data-testid="button-lookup-learner"
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
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-sm text-red-300" role="alert">
                            {lookupError}
                          </p>
                          {/^Aucun apprenant/.test(lookupError) && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={invite.isPending}
                              onClick={() => invite.mutate()}
                              data-testid="button-invite-learner"
                            >
                              {invite.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Mail className="mr-2 h-4 w-4" />
                              )}
                              Inviter par e-mail
                            </Button>
                          )}
                        </div>
                      )}
                      {found && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border p-3"
                          data-testid="learner-found"
                        >
                          <div>
                            <div className="font-medium text-foreground">{found.fullName}</div>
                            <div className="text-sm text-muted-foreground">{found.email}</div>
                          </div>
                          {alreadyAttached ? (
                            <Badge variant="outline">Déjà rattaché à cette roadmap</Badge>
                          ) : (
                            <Button
                              type="button"
                              disabled={attach.isPending}
                              onClick={() => attach.mutate(found.id)}
                              data-testid="button-attach-learner"
                            >
                              {attach.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                              )}
                              Rattacher
                            </Button>
                          )}
                        </div>
                      )}
                    </form>
                  )}
                  {mentor && (invitations.data ?? []).length > 0 && (
                    <div className="mt-6 space-y-2" data-testid="invitations-list">
                      <h3 className="font-semibold text-foreground">Invitations</h3>
                      {(invitations.data ?? []).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border p-3"
                          data-testid={`invitation-${entry.id}`}
                        >
                          <div>
                            <div className="font-medium text-foreground">{entry.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {INVITATION_STATE_LABEL[entry.state]}
                              {entry.state === "PENDING" &&
                                ` · expire le ${new Date(entry.expiresAt).toLocaleDateString("fr-FR")}`}
                            </div>
                          </div>
                          {entry.state === "PENDING" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resend.isPending}
                                onClick={() => resend.mutate(entry.id)}
                                data-testid={`button-resend-${entry.id}`}
                              >
                                Renvoyer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={revoke.isPending}
                                onClick={() => revoke.mutate(entry.id)}
                                data-testid={`button-revoke-${entry.id}`}
                              >
                                Révoquer
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
