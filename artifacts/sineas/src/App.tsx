import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from '@clerk/react/internal';
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Browse from "@/pages/browse";
import Watch from "@/pages/watch";
import UploadPage from "@/pages/upload";
import Subscription from "@/pages/subscription";
import Profile from "@/pages/profile";
import Dashboard from "@/pages/dashboard";
import SearchPage from "@/pages/search";
import CreatorPage from "@/pages/creator";
import WatchlistPage from "@/pages/watchlist";
import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { ThemeProvider } from "@/components/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0f1e] px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0f1e] px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AuthListener() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/browse" component={Browse} />
      <Route path="/watch/:id" component={Watch} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/profile" component={Profile} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/search" component={SearchPage} />
      <Route path="/creator/:id" component={CreatorPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e] text-white">
        <p>Konfigurasi Clerk tidak ditemukan</p>
      </div>
    );
  }

  const [, setLocation] = useLocation();

  return (
    <ThemeProvider>
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
        appearance={{
          variables: {
            colorPrimary: "hsl(221, 83%, 53%)",
            colorBackground: "hsl(223, 44%, 11%)",
            colorInputBackground: "hsl(222, 30%, 17%)",
            colorText: "white",
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthListener />
            <WouterRouter base={basePath}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}

export default App;
