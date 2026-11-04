"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishAuthCallback } from "../auth/actions";
import { authErrorMessage } from "../auth/errors";

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const exchange = useRef<Promise<string> | null>(null);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    if (!exchange.current) {
      const address = window.location.href;
      // Remove the one-time code from the visible URL and future referrers before awaiting network.
      window.history.replaceState(null, "", window.location.pathname);
      exchange.current = finishAuthCallback(address);
    }
    void exchange.current
      .then((next) => {
        if (active) router.replace(next);
      })
      .catch((cause) => {
        if (active) setError(authErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <div className="page account-page">
      <section className="account-card">
        <h1>確認會員驗證</h1>
        {error ? (
          <>
            <p className="inline-error" role="alert">
              {error}
            </p>
            <Link className="button primary" href="/account/">
              回到會員頁
            </Link>
          </>
        ) : (
          <p role="status">正在確認登入，完成後會回到會員頁。</p>
        )}
      </section>
    </div>
  );
}
