"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error("NADORIO page failed", {
      digest: error.digest || "client-render",
    });
  }, [error]);
  return (
    <section className="panel" style={{ padding: 24 }} role="alert">
      <h1>This page couldn’t load</h1>
      <p>
        Please retry. If the problem continues, contact your organization
        administrator.
      </p>
      {error.digest && <p>Reference: {error.digest}</p>}
      <button
        className="button secondary"
        onClick={() => {
          router.refresh();
          reset();
        }}
      >
        Try again
      </button>
    </section>
  );
}
