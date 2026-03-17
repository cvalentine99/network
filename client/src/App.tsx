import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { TimeWindowProvider } from "./providers/TimeWindowProvider";
import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';

// PERF-C1: Lazy-load page components for code splitting
const Home = lazy(() => import("./pages/Home"));
const ApplianceSettings = lazy(() => import("./pages/ApplianceSettings"));
const FlowTheater = lazy(() => import("./pages/FlowTheater"));
const BlastRadius = lazy(() => import("./pages/BlastRadius"));
const Correlation = lazy(() => import("./pages/Correlation"));
const Topology = lazy(() => import('./pages/Topology'));
const Help = lazy(() => import('./pages/Help'));

// FE-H16: Per-route error boundary to isolate page-level crashes
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteError]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <DashboardLayout>
      <RouteErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }>
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
      </RouteErrorBoundary>
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
