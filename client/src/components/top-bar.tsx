import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { getCurrentUser, logout as performLogout, isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function TopBar() {
  const { toast } = useToast();
  const user = getCurrentUser();

  const handleLogout = () => {
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !",
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

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] w-full bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-lg">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 shadow-md">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Roadmap Mentor</h1>
            <p className="text-xs text-white/70">Backend Python Mentorat</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{user?.fullName}</p>
            <p className="text-xs text-white/70">{user?.email}</p>
          </div>

          <Badge 
            variant={isMentor() ? "default" : "secondary"}
            className={`${
              isMentor() 
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0" 
                : "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0"
            } px-3 py-1 shadow-md`}
            data-testid="badge-user-role"
          >
            {user?.role === "MENTOR" ? "Mentor" : "Apprenant"}
          </Badge>

          <Avatar className="w-10 h-10 border-2 border-white/30 shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-rose-500 text-white font-semibold">
              {user ? getInitials(user.fullName) : "U"}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
