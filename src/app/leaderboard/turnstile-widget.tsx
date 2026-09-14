'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Cloudflare Turnstile, rendered explicitly so the script is only loaded on
 * the join page and only when a site key is configured. `onToken` receives
 * the pass token, or undefined when it expires and a fresh one is needed.
 */
export default function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | undefined) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | undefined;
    const render = () => {
      if (!container.current || !window.turnstile) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(undefined),
        'error-callback': () => onTokenRef.current(undefined),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_SRC}"]`,
      );
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', render, { once: true });
      if (!existing) {
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={container} className="my-3" />;
}
