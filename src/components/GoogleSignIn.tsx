import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Loader, Text, View } from "reshaped";
import { SignInError, useSession, useSignIn, useSignOut } from "@/lib/session";

/*
 * Google sign-in, through Google Identity Services.
 *
 * Google renders the button and hands back an ID token for the dmbk OAuth
 * client; `/api/session` trades it with the accounts API for a session. The
 * page's origin must be an authorized JavaScript origin on that client —
 * Google refuses to render the button anywhere else, including Vercel
 * preview URLs.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: { theme?: string; size?: string; text?: string; shape?: string },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

interface GoogleSignInProps {
  onSuccess?: () => void;
}

export default function GoogleSignIn({ onSuccess }: GoogleSignInProps) {
  const { viewer, isPending, error: sessionError } = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && !!window.google?.accounts?.id,
  );
  const [scriptFailed, setScriptFailed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCredential = useCallback(
    async ({ credential }: { credential?: string }) => {
      if (!credential) {
        setError("Google did not return a sign-in token. Try again.");
        return;
      }
      setError(null);
      setSigningIn(true);
      try {
        await signIn(credential);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof SignInError ? err.message : "Sign-in failed. Try again.");
      } finally {
        setSigningIn(false);
      }
    },
    [signIn, onSuccess],
  );

  const showButton = !viewer && !isPending;

  useEffect(() => {
    const id = window.google?.accounts?.id;
    if (!showButton || !scriptReady || !id || !CLIENT_ID || !buttonRef.current) return;
    id.initialize({ client_id: CLIENT_ID, callback: onCredential, ux_mode: "popup" });
    buttonRef.current.replaceChildren();
    id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
    });
  }, [showButton, scriptReady, onCredential]);

  return (
    <View gap={6} maxWidth="400px" attributes={{ style: { minWidth: 280 } }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setScriptFailed(true)}
      />

      {error && <Alert color="critical">{error}</Alert>}
      {sessionError && <Alert color="warning">{sessionError.message}</Alert>}

      {isPending ? (
        <View align="center">
          <Loader />
        </View>
      ) : viewer ? (
        <View gap={4}>
          <View gap={1}>
            <Text variant="body-3" color="neutral-faded">
              Signed in as
            </Text>
            <Text variant="body-2">{viewer.email}</Text>
          </View>
          <Button color="neutral" fullWidth onClick={() => void signOut()}>
            Sign Out
          </Button>
        </View>
      ) : !CLIENT_ID ? (
        <Alert color="warning">
          Google sign-in is not configured: NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset.
        </Alert>
      ) : scriptFailed ? (
        <Alert color="warning">
          Google sign-in could not load. Check your connection or any blocker, then reload this page.
        </Alert>
      ) : signingIn ? (
        <View direction="row" gap={3} align="center">
          <Loader size="small" ariaLabel="Signing in" />
          <Text color="neutral-faded">Signing in…</Text>
        </View>
      ) : null}

      {/* Google renders its button into this element. Kept mounted while
          signing in so a failure can be retried without reloading. */}
      <div
        ref={buttonRef}
        data-testid="google-sign-in"
        hidden={!showButton || !CLIENT_ID || scriptFailed || signingIn}
        style={{ minHeight: 44, colorScheme: "light" }}
      />
    </View>
  );
}
