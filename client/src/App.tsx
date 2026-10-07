import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "@/pages/auth-page";
import RoadmapPage from "@/pages/roadmap-page";
import PreferencesPage from "@/pages/preferences";
import MentoringPage from "@/pages/mentoring";
import RoadmapsPage from "@/pages/roadmaps";
import InvitePage from "@/pages/invite-page";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { isAuthenticated, setCurrentUser } from "@/lib/auth";
import mentorBg from "./assets/mentor-bg.jpg";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <Redirect to="/" />;
  }
  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  if (isAuthenticated()) {
    return <Redirect to="/roadmap" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute component={AuthPage} />
      </Route>
      <Route path="/login">
        <PublicRoute component={AuthPage} />
      </Route>
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/roadmap">
        <ProtectedRoute component={RoadmapPage} />
      </Route>
      <Route path="/preferences">
        <ProtectedRoute component={PreferencesPage} />
      </Route>
      <Route path="/roadmaps">
        <ProtectedRoute component={RoadmapsPage} />
      </Route>
      <Route path="/mentoring">
        <ProtectedRoute component={MentoringPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Aligne l'identité locale (rôle, nom) sur le serveur avant d'afficher les pages protégées.
function useSessionSync() {
  const [ready, setReady] = useState(!isAuthenticated());

  useEffect(() => {
    if (ready) return;
    apiRequest("GET", "/api/auth/me")
      .then((user) => setCurrentUser(user))
      .catch(() => undefined) // un 401 ferme déjà la session ; une panne réseau ne bloque pas l'affichage
      .finally(() => setReady(true));
  }, [ready]);

  return ready;
}

function App() {
  const sessionReady = useSessionSync();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div 
          className="min-h-screen w-full relative overflow-hidden"
          style={{ 
            backgroundImage: `url(${mentorBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/75 to-black/85" />
          
          {/* Content */}
          <div className="relative z-10 min-h-screen">
            {sessionReady && <Router />}
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
