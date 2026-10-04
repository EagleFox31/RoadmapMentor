import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock3, Loader2, UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type {
  MentoringPackageWithScope,
  MentoringSession,
  WeekWithDetails,
} from "@shared/schema";

type SessionHistoryResponse = {
  sessions: MentoringSession[];
  packageUsage: Array<{
    packageId: number;
    title: string;
    includedSessionCount: number;
    usedSessionCount: number;
    remainingSessionCount: number;
  }>;
};

type Props = {
  mentorshipId: number;
  packages: MentoringPackageWithScope[];
  weeks: WeekWithDetails[];
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

function formatSessionDate(value: Date | string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function MentoringSessions({ mentorshipId, packages, weeks }: Props) {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    packageId: "",
    weekId: "",
    title: "",
    date: "",
    startTime: "16:00",
    endTime: "19:00",
    isAdditional: false,
  });

  const queryKey = ["/api/mentorships", mentorshipId, "sessions", month];
  const { data, isLoading } = useQuery<SessionHistoryResponse>({
    queryKey,
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/mentorships/" + mentorshipId + "/sessions?month=" + month,
      ),
  });

  const weekOptions = useMemo(
    () =>
      weeks.map((week) => ({
        id: week.id,
        label: "S" + week.number + " · " + week.title,
      })),
    [weeks],
  );

  const createSession = useMutation({
    mutationFn: () => {
      const startsAt = new Date(
        form.date + "T" + form.startTime + ":00",
      ).toISOString();
      const endsAt = new Date(
        form.date + "T" + form.endTime + ":00",
      ).toISOString();

      return apiRequest(
        "POST",
        "/api/mentorships/" + mentorshipId + "/sessions",
        {
          packageId: form.packageId ? Number(form.packageId) : null,
          weekId: form.weekId ? Number(form.weekId) : null,
          title: form.title,
          startsAt,
          endsAt,
          isAdditional: form.isAdditional,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/mentorships", mentorshipId, "sessions"],
      });
      setForm({
        packageId: "",
        weekId: "",
        title: "",
        date: "",
        startTime: "16:00",
        endTime: "19:00",
        isAdditional: false,
      });
      toast({
        title: "Séance planifiée",
        description: "Elle apparaît maintenant dans l’historique du mentorat.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Séance non créée",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeSession = useMutation({
    mutationFn: ({
      id,
      learnerAttended,
    }: {
      id: number;
      learnerAttended: boolean;
    }) =>
      apiRequest("POST", "/api/sessions/" + id + "/complete", {
        learnerAttended,
        mentorNotes: notes[id]?.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/mentorships", mentorshipId, "sessions"],
      });
    },
  });

  const cancelSession = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", "/api/sessions/" + id + "/cancel", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/mentorships", mentorshipId, "sessions"],
      });
    },
  });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-sky-300" />
          <div>
            <h2 className="font-semibold">Séances de mentorat</h2>
            <p className="text-xs text-slate-400">
              Planning, présence et consommation du forfait.
            </p>
          </div>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="w-[180px] border-white/10 bg-black/20"
        />
      </div>

      {data?.packageUsage && data.packageUsage.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.packageUsage.map((usage) => (
            <div
              key={usage.packageId}
              className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4"
            >
              <p className="text-sm font-medium">{usage.title}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">
                {usage.usedSessionCount}/{usage.includedSessionCount}
              </p>
              <p className="text-xs text-slate-400">
                {usage.remainingSessionCount} séance(s) incluse(s) restante(s)
              </p>
            </div>
          ))}
        </div>
      )}

      {isMentor() && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
          <h3 className="font-medium">Planifier une séance</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Titre"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border-white/10 bg-black/20"
            />
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="border-white/10 bg-black/20"
            />
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="border-white/10 bg-black/20"
            />
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="border-white/10 bg-black/20"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <select
              value={form.packageId}
              onChange={(e) => setForm({ ...form, packageId: e.target.value })}
              className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Forfait lié</option>
              {packages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <select
              value={form.weekId}
              onChange={(e) => setForm({ ...form, weekId: e.target.value })}
              className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Semaine de roadmap (optionnel)</option>
              {weekOptions.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isAdditional}
              onChange={(e) =>
                setForm({ ...form, isAdditional: e.target.checked })
              }
            />
            Séance additionnelle — ne pas la décompter du forfait inclus
          </label>

          <Button
            className="mt-4"
            onClick={() => createSession.mutate()}
            disabled={
              createSession.isPending ||
              !form.title ||
              !form.date ||
              (!form.isAdditional && !form.packageId)
            }
          >
            {createSession.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Planifier
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : !data?.sessions.length ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
            Aucune séance pour ce mois.
          </p>
        ) : (
          data.sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-white/10 bg-black/10 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{session.title}</h3>
                    <Badge
                      className={
                        session.isAdditional
                          ? "bg-amber-300/10 text-amber-200"
                          : "bg-emerald-300/10 text-emerald-200"
                      }
                    >
                      {session.isAdditional ? "Additionnelle" : "Incluse"}
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                    <Clock3 className="h-4 w-4" />
                    {formatSessionDate(session.startsAt)} →{" "}
                    {formatSessionDate(session.endsAt)}
                  </p>
                </div>
                <Badge className="bg-white/10 text-slate-200">
                  {session.status}
                </Badge>
              </div>

              {session.mentorNotes && (
                <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                  {session.mentorNotes}
                </p>
              )}

              {isMentor() && session.status === "SCHEDULED" && (
                <div className="mt-4">
                  <Textarea
                    placeholder="Notes de séance (optionnel)"
                    value={notes[session.id] || ""}
                    onChange={(event) =>
                      setNotes({
                        ...notes,
                        [session.id]: event.target.value,
                      })
                    }
                    className="border-white/10 bg-black/20"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        completeSession.mutate({
                          id: session.id,
                          learnerAttended: true,
                        })
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Présent · terminer
                    </Button>
                    <Button
                      variant="outline"
                      className="border-amber-300/20"
                      onClick={() =>
                        completeSession.mutate({
                          id: session.id,
                          learnerAttended: false,
                        })
                      }
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      No-show
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-300/20"
                      onClick={() => cancelSession.mutate(session.id)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
