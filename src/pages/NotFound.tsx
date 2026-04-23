import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      {/* Decorative gradient orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_70%)]"
      />

      <section className="relative z-10 mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Compass className="h-3.5 w-3.5" />
          Lost in space
        </div>

        <h1 className="bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-[8rem] font-black leading-none tracking-tighter text-transparent sm:text-[10rem]">
          404
        </h1>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h2>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          The page{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
            {location.pathname}
          </code>{" "}
          doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
