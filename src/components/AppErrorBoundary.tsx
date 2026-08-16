import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-card">
          <h1 className="font-serif text-2xl font-bold">Une erreur est survenue</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            La page n’a pas pu s’afficher correctement. Rechargez-la pour réessayer.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Recharger la page
          </Button>
        </section>
      </main>
    );
  }
}
