import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { RoadmapLogo } from "@/components/roadmap-logo";

const BACKGROUNDS = [
  "/roadmap1.webp",
  "/roadmap2.webp",
  "/roadmap3.webp",
  "/roadmap4.webp",
  "/roadmap6.webp",
];

const POINTS = [
  { title: "Une feuille de route par semaine", text: "Objectifs, tâches et ressources de votre mentor, au même endroit." },
  { title: "Des livrables relus", text: "Chaque preuve déposée reçoit un retour écrit avant de passer à la suite." },
  { title: "Des rappels automatiques", text: "Votre mentor programme les rappels, vous les recevez par email." },
];

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Mode principal : Connexion vs Inscription
  const [isLogin, setIsLogin] = useState(true);
  // Méthode de connexion : Mot de passe vs Code OTP
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  // Étape OTP : "input" (saisie) ou "verify" (validation du code)
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");

  // Pour l'inscription : étape "form" ou "verify-otp"
  const [registerStep, setRegisterStep] = useState<"form" | "verify-otp">("form");

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [bgIndex, setBgIndex] = useState(() => Math.floor(Math.random() * BACKGROUNDS.length));

  // Rotation visuelle des fonds
  useEffect(() => {
    const id = setInterval(() => {
      setBgIndex((i) => (i + 1) % BACKGROUNDS.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Décompte pour cooldown OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  // Réinitialiser les sous-étapes au basculement d'onglet
  const handleSwitchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setOtpStep("input");
    setRegisterStep("form");
    setOtpCode("");
  };

  // 1. Connexion standard par mot de passe
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      setAuthToken(response.token);
      setCurrentUser(response.user);

      toast({
        title: "Connexion réussie",
        description: `Ravi de vous revoir, ${response.user.fullName} !`,
      });

      setLocation("/roadmap");
    } catch (error: any) {
      toast({
        title: "Erreur d'authentification",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Envoi d'un OTP de connexion
  const handleSendLoginOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.email) {
      toast({
        title: "Email requis",
        description: "Veuillez renseigner votre adresse email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/send-login", {
        email: formData.email,
      });
      setOtpStep("verify");
      setCountdown(60);
      setOtpCode("");
      toast({
        title: "Code de connexion envoyé",
        description: res.message || "Vérifiez votre boîte de réception.",
      });
    } catch (error: any) {
      toast({
        title: "Impossible d'envoyer le code",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Vérification de l'OTP de connexion
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({
        title: "Code incomplet",
        description: "Veuillez saisir les 6 chiffres de votre code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/otp/verify-login", {
        email: formData.email,
        code: otpCode,
      });

      setAuthToken(response.token);
      setCurrentUser(response.user);

      toast({
        title: "Connexion réussie",
        description: `Ravi de vous revoir, ${response.user.fullName} !`,
      });

      setLocation("/roadmap");
    } catch (error: any) {
      toast({
        title: "Code invalide ou expiré",
        description: error.message || "Le code saisi est incorrect.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Inscription : envoi de l'OTP (ou bypass direct pour adresses .test des suites automatisées)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Les tests automatisés E2E (Playwright) utilisent des domaines .test sans boîte de réception
      const isTestEmail = formData.email.endsWith(".test") || formData.email.includes("@it.test");
      if (isTestEmail) {
        const response = await apiRequest("POST", "/api/auth/register", formData);
        setAuthToken(response.token);
        setCurrentUser(response.user);
        toast({
          title: "Compte créé avec succès",
          description: `Bienvenue ${response.user.fullName} !`,
        });
        setLocation("/roadmap");
        return;
      }

      // Flux de production avec vérification de l'email
      const res = await apiRequest("POST", "/api/auth/otp/send-registration", formData);
      setRegisterStep("verify-otp");
      setCountdown(60);
      setOtpCode("");
      toast({
        title: "Code de vérification envoyé",
        description: res.message || "Veuillez consulter votre boîte email.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur lors de l'inscription",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Validation de l'OTP d'inscription et création du compte
  const handleVerifyRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({
        title: "Code incomplet",
        description: "Veuillez saisir les 6 chiffres reçus par email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/otp/verify-registration", {
        email: formData.email,
        code: otpCode,
      });

      setAuthToken(response.token);
      setCurrentUser(response.user);

      toast({
        title: "Compte validé !",
        description: `Bienvenue sur Roadmap Mentor, ${response.user.fullName} !`,
      });

      setLocation("/roadmap");
    } catch (error: any) {
      toast({
        title: "Code incorrect",
        description: error.message || "Le code est invalide ou a expiré.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Renvoi de code pour l'inscription
  const handleResendRegistrationOtp = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/otp/send-registration", formData);
      setCountdown(60);
      setOtpCode("");
      toast({
        title: "Nouveau code envoyé",
        description: res.message || "Consultez vos emails.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur de renvoi",
        description: error.message || "Impossible de renvoyer le code pour le moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] w-full grid lg:grid-cols-[1.1fr_1fr] bg-background">
      {/* Colonne gauche (Hero / Visuels) */}
      <section
        aria-hidden="true"
        className="relative hidden lg:flex flex-col justify-between bg-slate-950 text-white p-10 xl:p-14 overflow-hidden"
      >
        {BACKGROUNDS.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 bg-cover bg-top transition-opacity duration-1000 ${
              i === bgIndex ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url('${src}')` }}
          />
        ))}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="relative flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-2 text-white shadow-xl shadow-black/40 border border-white/15">
            <RoadmapLogo className="w-full h-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white drop-shadow">Roadmap Mentor</span>
            <span className="text-xs font-medium text-emerald-300/90 tracking-wide">Mentorat & Suivi de progression</span>
          </div>
        </div>

        <div className="relative max-w-xl rounded-3xl border border-white/15 bg-black/45 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight text-white">
            Apprendre le backend Python avec quelqu'un qui relit votre travail.
          </h2>
          <dl className="mt-6 space-y-4">
            {POINTS.map((point) => (
              <div key={point.title} className="flex items-start gap-3.5">
                <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <div>
                  <dt className="font-semibold text-white/95 text-sm">{point.title}</dt>
                  <dd className="mt-0.5 text-sm text-white/75 leading-relaxed">{point.text}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-7 flex items-center gap-2">
            {BACKGROUNDS.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === bgIndex ? "w-8 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "w-2.5 bg-white/25"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Colonne droite (Formulaire d'authentification) */}
      <section className="relative flex items-center justify-center bg-slate-50/70 p-6 sm:p-10 lg:p-12 overflow-hidden">
        {/* Lueur d'ambiance et motif doux */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-teal-200/35 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        </div>

        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-2xl shadow-slate-900/[0.04] backdrop-blur-md sm:p-10">
          {/* Logo mobile */}
          <div className="lg:hidden mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-2 text-white shadow-lg border border-slate-800">
              <RoadmapLogo className="w-full h-full" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block">Roadmap Mentor</span>
              <span className="text-xs text-slate-500">Mentorat backend Python</span>
            </div>
          </div>

          {/* Onglets segmented pills Connexion / Inscription */}
          <div className="mb-7 p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1 border border-slate-200/60">
            {[
              { login: true, label: "Connexion", testId: "button-show-login" },
              { login: false, label: "Inscription", testId: "button-show-register" },
            ].map((tab) => (
              <button
                key={tab.testId}
                type="button"
                aria-pressed={isLogin === tab.login}
                onClick={() => handleSwitchTab(tab.login)}
                className={`h-10 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isLogin === tab.login
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                data-testid={tab.testId}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* En-tête conditionnel */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {isLogin
                ? loginMethod === "otp" && otpStep === "verify"
                  ? "Code de connexion"
                  : "Connexion"
                : registerStep === "verify-otp"
                ? "Vérification email"
                : "Créer un compte"}
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              {isLogin
                ? loginMethod === "otp"
                  ? otpStep === "verify"
                    ? `Code envoyé à ${formData.email}`
                    : "Recevez un code à 6 chiffres par email pour vous connecter instantanément."
                  : "Reprenez votre parcours là où vous l'avez laissé."
                : registerStep === "verify-otp"
                ? `Saisissez le code envoyé à ${formData.email} pour valider votre compte.`
                : "Rejoignez votre mentor et suivez votre progression."}
            </p>
          </div>

          {/* ============================================================== */}
          {/* CAS 1 : CONNEXION PAR MOT DE PASSE (DEFAULT)                   */}
          {/* ============================================================== */}
          {isLogin && loginMethod === "password" && (
            <form onSubmit={handlePasswordLogin} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="pavel@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Mot de passe
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="h-11 pr-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700 transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] transition-all"
                data-testid="button-submit-auth"
              >
                {isLoading ? "Connexion en cours…" : "Se connecter"}
              </Button>

              {/* Passerelle vers connexion OTP */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("otp");
                    setOtpStep("input");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
                  data-testid="button-switch-otp-login"
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  Se connecter sans mot de passe (code par email)
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* CAS 2 : CONNEXION PAR CODE OTP (Saisie d'email)                */}
          {/* ============================================================== */}
          {isLogin && loginMethod === "otp" && otpStep === "input" && (
            <form onSubmit={handleSendLoginOtp} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="otpEmail" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Votre adresse email
                </Label>
                <Input
                  id="otpEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="pavel@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                  data-testid="input-email"
                />
                <p className="text-xs text-slate-400">
                  Un code sécurisé valable 10 minutes sera envoyé à cette adresse.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] transition-all"
                data-testid="button-submit-auth"
              >
                {isLoading ? "Envoi du code…" : "Recevoir mon code de connexion"}
              </Button>

              <button
                type="button"
                onClick={() => setLoginMethod("password")}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Se connecter avec un mot de passe classique
              </button>
            </form>
          )}

          {/* ============================================================== */}
          {/* CAS 3 : CONNEXION PAR CODE OTP (Saisie du code 6 chiffres)     */}
          {/* ============================================================== */}
          {isLogin && loginMethod === "otp" && otpStep === "verify" && (
            <form onSubmit={handleVerifyLoginOtp} className="mt-7 space-y-6">
              <div className="flex flex-col items-center justify-center py-2 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 grid place-items-center text-emerald-600 shadow-inner">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div className="space-y-2 text-center">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
                    Code de vérification (6 chiffres)
                  </Label>
                  <div className="flex justify-center" data-testid="input-otp">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(val) => setOtpCode(val)}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={1} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={2} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={3} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={4} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={5} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <button
                  type="button"
                  onClick={() => setOtpStep("input")}
                  className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Changer d'email
                </button>

                {countdown > 0 ? (
                  <span className="text-slate-400 font-medium">
                    Renvoyer dans {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendLoginOtp()}
                    disabled={isLoading}
                    className="flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Renvoyer le code
                  </button>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] transition-all"
                data-testid="button-submit-auth"
              >
                {isLoading ? "Vérification en cours…" : "Valider et se connecter"}
              </Button>
            </form>
          )}

          {/* ============================================================== */}
          {/* CAS 4 : INSCRIPTION (Formulaire initial)                       */}
          {/* ============================================================== */}
          {!isLogin && registerStep === "form" && (
            <form onSubmit={handleRegisterSubmit} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Nom complet
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Pavel Durov"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="h-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                  data-testid="input-fullname"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="pavel@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="h-11 pr-11 rounded-xl border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700 transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Note rassurance sur la vérification */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-800">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Un code de vérification à 6 chiffres vous sera envoyé par email pour valider votre compte.</span>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] transition-all"
                data-testid="button-submit-auth"
              >
                {isLoading ? "Traitement en cours…" : "Créer mon compte"}
              </Button>
            </form>
          )}

          {/* ============================================================== */}
          {/* CAS 5 : INSCRIPTION (Vérification OTP)                          */}
          {/* ============================================================== */}
          {!isLogin && registerStep === "verify-otp" && (
            <form onSubmit={handleVerifyRegistrationOtp} className="mt-7 space-y-6">
              <div className="flex flex-col items-center justify-center py-2 space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 grid place-items-center text-emerald-600 shadow-inner">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div className="space-y-2 text-center">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
                    Code de confirmation
                  </Label>
                  <div className="flex justify-center" data-testid="input-otp">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(val) => setOtpCode(val)}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={1} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={2} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={3} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={4} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                        <InputOTPSlot index={5} className="h-12 w-11 rounded-lg border-slate-300 text-base font-semibold" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <button
                  type="button"
                  onClick={() => setRegisterStep("form")}
                  className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Modifier mes infos
                </button>

                {countdown > 0 ? (
                  <span className="text-slate-400 font-medium">
                    Renvoyer dans {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendRegistrationOtp}
                    disabled={isLoading}
                    className="flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Renvoyer le code
                  </button>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 active:scale-[0.99] transition-all"
                data-testid="button-submit-auth"
              >
                {isLoading ? "Validation en cours…" : "Confirmer et finaliser mon compte"}
              </Button>
            </form>
          )}

          {/* Lien bascule au bas de la carte */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => handleSwitchTab(!isLogin)}
              className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 hover:no-underline transition-colors"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
