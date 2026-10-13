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
    additionalPrice: "",
    additionalCurrency: "XAF",
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
          additionalPriceMinor: form.isAdditional
            ? Number(form.additionalPrice)
            : null,
          additionalPriceCurrency: form.isAdditional
            ? form.additionalCurrency
            : null,
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
        additionalPrice: "",
        additionalCurrency: "XAF",
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
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Séances de mentorat</h2>
            <p className="text-xs text-slate-500">
              Planning, présence et consommation du forfait.
            </p>
          </div>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="w-[180px] border-slate-200 bg-white rounded-xl text-slate-800"
        />
      </div>

      {data?.packageUsage && data.packageUsage.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.packageUsage.map((usage) => (
            <div
              key={usage.packageId}
              className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4"
            >
              <p className="text-sm font-semibold text-slate-900">{usage.title}</p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                {usage.usedSessionCount}/{usage.includedSessionCount}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {usage.remainingSessionCount} séance(s) incluse(s) restante(s)
              </p>
            </div>
          ))}
        </div>
      )}

      {isMentor() && (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 space-y-3">
          <h3 className="font-bold text-slate-900">Planifier une séance</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Titre"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border-slate-200 bg-white rounded-xl"
            />
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="border-slate-200 bg-white rounded-xl"
            />
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="border-slate-200 bg-white rounded-xl"
            />
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="border-slate-200 bg-white rounded-xl"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={form.packageId}
              onChange={(e) => setForm({ ...form, packageId: e.target.value })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs"
            >
              <option value="">Semaine de roadmap (optionnel)</option>
              {weekOptions.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-700 font-medium pt-1">
            <input
              type="checkbox"
              checked={form.isAdditional}
              onChange={(e) =>
                setForm({ ...form, isAdditional: e.target.checked })
              }
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Séance additionnelle — ne pas la décompter du forfait inclus
          </label>

          {form.isAdditional && (
            <div className="grid max-w-md grid-cols-[1fr_90px] gap-2 pt-1">
              <Input
                type="number"
                min="1"
                placeholder="Prix de la séance"
                value={form.additionalPrice}
                onChange={(e) =>
                  setForm({ ...form, additionalPrice: e.target.value })
                }
                className="border-amber-200 bg-white rounded-xl"
              />
              <Input
                maxLength={3}
                value={form.additionalCurrency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    additionalCurrency: e.target.value.toUpperCase(),
                  })
                }
                className="border-amber-200 bg-white rounded-xl uppercase"
              />
            </div>
          )}

          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs"
            onClick={() => createSession.mutate()}
            disabled={
              createSession.isPending ||
              !form.title ||
              !form.date ||
              (!form.isAdditional && !form.packageId) ||
              (form.isAdditional &&
                (!form.additionalPrice || !form.additionalCurrency))
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
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 text-center">
            Aucune séance pour ce mois.
          </p>
        ) : (
          data.sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{session.title}</h3>
                    <Badge
                      className={
                        session.isAdditional
                          ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                      }
                    >
                      {session.isAdditional ? "Additionnelle" : "Incluse"}
                    </Badge>
                    {session.isAdditional &&
                      session.additionalPriceMinor !== null &&
                      session.additionalPriceCurrency && (
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-semibold">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: session.additionalPriceCurrency,
                            maximumFractionDigits:
                              session.additionalPriceCurrency === "XAF" ? 0 : 2,
                          }).format(session.additionalPriceMinor)}
                        </Badge>
                      )}
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <span>{formatSessionDate(session.startsAt)} →{" "}
                    {formatSessionDate(session.endsAt)}</span>
                  </p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-medium">
                  {session.status}
                </Badge>
              </div>

              {session.mentorNotes && (
                <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-700 leading-relaxed">
                  {session.mentorNotes}
                </p>
              )}

              {isMentor() && session.status === "SCHEDULED" && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  <Textarea
                    placeholder="Notes de séance (optionnel)"
                    value={notes[session.id] || ""}
                    onChange={(event) =>
                      setNotes({
                        ...notes,
                        [session.id]: event.target.value,
                      })
                    }
                    className="border-slate-200 bg-white rounded-xl text-slate-900"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs"
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
                      className="border-amber-200 text-amber-800 hover:bg-amber-50 rounded-xl"
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
                      className="border-rose-200 text-rose-800 hover:bg-rose-50 rounded-xl"
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
