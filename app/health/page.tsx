"use client";
import { useEffect, useState } from "react";
import Shell from "../../components/Shell";
export default function Health() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/platform/health", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  return (
    <Shell>
      <h1>Platform health</h1>
      <p>
        Read-only checks and configuration status. A configured credential does
        not establish successful delivery or publishing.
      </p>
      <button className="button secondary" disabled={loading} onClick={check}>
        {loading ? "Checking…" : "Run checks"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>Checked {new Date(data.checkedAt).toLocaleString()}</p>
          <div className="v11Grid">
            {data.checks.map((c: any) => (
              <section className="panel" key={c.name}>
                <h2>{c.name}</h2>
                <b>{c.status}</b>
                <p>{c.detail}</p>
              </section>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
