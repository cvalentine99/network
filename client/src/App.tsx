import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { TimeWindowProvider } from "./providers/TimeWindowProvider";
import { Loader2 } from "lucide-react";

// ─── Code splitting (Rec 5) ────────────────────────────────────────────
// Heavy pages are lazy-loaded so the initial bundle stays small.
// Home is kept eager since it's the landing page.
import Home from "./pages/Home";

const ApplianceSettings = lazy(() => import("./pages/ApplianceSettings"));
const FlowTheater = lazy(() => import("./pages/FlowTheater"));
const BlastRadius = lazy(() => import("./pages/BlastRadius"));
const Correlation = lazy(() => import("./pages/Correlation"));
const Topology = lazy(() => import("./pages/Topology"));
const Help = lazy(() => import("./pages/Help"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500/60" />
    </div>
  );
}

function Router() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/settings" component={ApplianceSettings} />
          <Route path="/flow-theater" component={FlowTheater} />
          <Route path="/blast-radius" component={BlastRadius} />
          <Route path="/correlation" component={Correlation} />
          <Route path="/topology" component={Topology} />
          <Route path="/help" component={Help} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <TimeWindowProvider>
            <Toaster />
            <Router />
          </TimeWindowProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
