import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { Alert, Loader, View } from "reshaped";
import ClientOnly from "./ClientOnly";

/*
 * The wrapper for one feature's Relay query: client-only, with a loader while
 * it suspends and an alert if it throws. A failing query takes down only its
 * own feature; the page shell and navigation keep rendering.
 */

interface ErrorBoundaryProps {
  title: string;
  children: ReactNode;
  /** Changing it clears a caught error, e.g. the record id the query reads. */
  resetKey?: unknown;
}

class FeatureErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null; resetKey: unknown }> {
  state = { error: null as Error | null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: { error: Error | null; resetKey: unknown }) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.title}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View padding={4}>
          <Alert color="critical" title={this.props.title}>
            {this.state.error.message}
          </Alert>
        </View>
      );
    }
    return this.props.children;
  }
}

export function FeatureLoader() {
  return (
    <View align="center" justify="center" padding={6} attributes={{ style: { height: "100%" } }}>
      <Loader />
    </View>
  );
}

interface FeatureBoundaryProps {
  /** The alert's title when the feature fails, e.g. "Failed to load gallery". */
  errorTitle: string;
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: unknown;
}

export default function FeatureBoundary({ errorTitle, children, fallback = <FeatureLoader />, resetKey }: FeatureBoundaryProps) {
  return (
    <ClientOnly fallback={fallback}>
      <FeatureErrorBoundary title={errorTitle} resetKey={resetKey}>
        <Suspense fallback={fallback}>{children}</Suspense>
      </FeatureErrorBoundary>
    </ClientOnly>
  );
}
