import * as Sentry from "@sentry/react";
import { Component, type ReactNode } from "react";
import type { ErrorEvent } from "@sentry/react";

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  delete event.breadcrumbs;
  delete event.contexts;
  delete event.extra;
  delete event.logentry;
  delete event.message;
  delete event.request;
  delete event.tags;
  delete event.user;

  for (const exception of event.exception?.values ?? []) {
    exception.value = "React render crash";
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }

  return event;
}

export function initializeMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const release = import.meta.env.VITE_SENTRY_RELEASE;
  if (!import.meta.env.PROD || !dsn || !release) return;

  Sentry.init({
    dsn,
    environment: "production",
    release,
    defaultIntegrations: false,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
  });
}

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    Sentry.captureException(error);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-shell" id="main-content">
        <section className="empty-state" role="alert">
          <h1>Something went wrong</h1>
          <p>Reload the page to try again.</p>
          <p>
            <button className="button button-primary" type="button" onClick={() => location.reload()}>
              Reload page
            </button>
          </p>
        </section>
      </main>
    );
  }
}
