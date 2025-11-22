import { Switch, Route, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "@/pages/auth-page";
import RoadmapPage from "@/pages/roadmap-page";
import NotFound from "@/pages/not-found";
import { isAuthenticated } from "@/lib/auth";
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
      <Route path="/roadmap">
        <ProtectedRoute component={RoadmapPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
            <Router />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
