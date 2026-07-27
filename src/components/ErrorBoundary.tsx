import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  /** Kurzer Titel der Fehlermeldung */
  title?: string;
  /** Erklärender Text für Nutzerinnen und Nutzer */
  description?: string;
  onRetry?: () => void;
};

type State = { hasError: boolean };

/**
 * Fängt Render-Fehler in einem Teilbereich ab und zeigt eine
 * verständliche Meldung statt einer weißen Seite.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI-Fehler abgefangen:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="rounded-2xl border border-border bg-card/60 p-6 text-center sm:p-10"
      >
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary/60">
          <AlertTriangle className="size-5 text-primary" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg tracking-wide">
          {this.props.title ?? "Dieser Bereich konnte nicht geladen werden"}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {this.props.description ??
            "Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, erreichen Sie uns jederzeit telefonisch oder per E-Mail."}
        </p>
        <Button className="mt-6" variant="secondary" onClick={this.handleRetry}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Erneut versuchen
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;
