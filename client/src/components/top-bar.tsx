import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  Compass,
  FolderKanban,
  LogOut,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoadmapLogo } from "@/components/roadmap-logo";
import { useLocation } from "wouter";
import { getCurrentUser, logout as performLogout } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function TopBar() {
  const { toast } = useToast();
  const user = getCurrentUser();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt sur votre feuille de route !",
    });
    performLogout();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isMentorRole = user?.role === "MENTOR";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-xs transition-all">
      <div className="flex h-16 sm:h-20 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* 1. Marque & Navigation Sémantique Principale */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            type="button"
            onClick={() => setLocation("/roadmap")}
            className="flex items-center gap-3 shrink-0 group text-left focus:outline-none"
            aria-label="Accueil Roadmap Mentor"
          >
            <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-md group-hover:border-emerald-500/50 group-hover:shadow-emerald-950/20 transition-all">
              <RoadmapLogo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:block min-w-0">
              <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight group-hover:text-emerald-700 transition-colors">
                Roadmap Mentor
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 tracking-wide block">
                Mentorat Backend Python
              </span>
            </div>
          </button>

          {/* Séparateur vertical */}
          <div className="hidden md:block h-6 w-px bg-slate-200" />

          {/* Liens de navigation explicites (sans Mystery Meat Icons) */}
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-1.5">
            {/* Onglet 1 : Feuille de route */}
            <button
              type="button"
              onClick={() => setLocation("/roadmap")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                location === "/roadmap"
                  ? "bg-emerald-50 text-emerald-900 shadow-2xs border border-emerald-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
              }`}
              data-testid="link-roadmap"
            >
              <Compass className={`w-4 h-4 ${location === "/roadmap" ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Feuille de route</span>
            </button>

            {/* Onglet 2 : Roadmaps */}
            <button
              type="button"
              onClick={() => setLocation("/roadmaps")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                location === "/roadmaps"
                  ? "bg-emerald-50 text-emerald-900 shadow-2xs border border-emerald-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
              }`}
              data-testid="button-roadmaps"
              title="Roadmaps et apprenants"
            >
              <FolderKanban className={`w-4 h-4 ${location === "/roadmaps" ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Roadmaps</span>
            </button>

            {/* Onglet 3 : Mentorat & Scope */}
            <button
              type="button"
              onClick={() => setLocation("/mentoring")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                location === "/mentoring"
                  ? "bg-emerald-50 text-emerald-900 shadow-2xs border border-emerald-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
              }`}
              data-testid="button-mentoring"
              title="Mentorat & forfaits"
            >
              <BriefcaseBusiness className={`w-4 h-4 ${location === "/mentoring" ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Mentorat</span>
            </button>
          </nav>
        </div>

        {/* 2. Centre : Indicateur Andragogique & Momentum (visible sur grand écran) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/70 text-xs text-slate-700 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-medium text-slate-600">
            {isMentorRole ? "Espace Mentor • Supervision apprenants" : "Progression continue • ShopFlow Backend"}
          </span>
        </div>

        {/* 3. Droite : Identité, Menu Déroulant & Déconnexion */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Badge Rôle */}
          <Badge
            className={`${
              isMentorRole
                ? "bg-indigo-50 text-indigo-800 border-indigo-200/80 hover:bg-indigo-100"
                : "bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100"
            } px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 border`}
            data-testid="badge-user-role"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMentorRole ? "bg-indigo-500" : "bg-emerald-500 animate-pulse"}`} />
            <span>{isMentorRole ? "Mentor" : "Apprenant"}</span>
          </Badge>

          {/* Menu Déroulant Utilisateur (Profil, Notifications, Préférences) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 pl-1 sm:pl-2 py-1 pr-2 rounded-2xl hover:bg-slate-100/80 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 group cursor-pointer"
                data-testid="button-user-menu"
                aria-label="Menu utilisateur"
              >
                <Avatar className="w-9 h-9 sm:w-10 sm:h-10 border border-slate-200 shadow-xs ring-2 ring-emerald-500/10 group-hover:ring-emerald-500/30 transition-all">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white font-bold text-xs sm:text-sm">
                    {user ? getInitials(user.fullName) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-800 max-w-[130px] truncate leading-tight group-hover:text-emerald-800 transition-colors">
                    {user?.fullName}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 leading-tight">
                    {user?.email}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 p-2 rounded-2xl border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-slate-900/10 z-50"
            >
              <DropdownMenuLabel className="px-3 py-2 font-normal">
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              
              {/* Option 1 : Profil */}
              <DropdownMenuItem
                onClick={() => setLocation("/profile")}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                data-testid="menu-item-profile"
              >
                <User className="w-4 h-4 text-emerald-600" />
                <span>Mon profil</span>
              </DropdownMenuItem>

              {/* Option 2 : Notifications */}
              <DropdownMenuItem
                onClick={() => setLocation("/notifications")}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                data-testid="menu-item-notifications"
              >
                <Bell className="w-4 h-4 text-teal-600" />
                <span>Notifications</span>
              </DropdownMenuItem>

              {/* Option 3 : Préférences */}
              <DropdownMenuItem
                onClick={() => setLocation("/preferences")}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4 text-slate-600" />
                <span>Préférences</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-slate-100" />

              {/* Déconnexion dans le dropdown */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Se déconnecter</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Séparateur vertical */}
          <div className="h-5 w-px bg-slate-200 mx-0.5 sm:mx-1" />

          {/* Bouton Déconnexion Direct (Rétrocompatibilité E2E Playwright button-logout) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
            data-testid="button-logout"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
