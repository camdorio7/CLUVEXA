"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, Sparkles } from "lucide-react";
import Shell from "../../../components/Shell";
import { createClient } from "../../../lib/supabase/client";
import { organizationTypes } from "../../../lib/organization-types";
const configs = Object.fromEntries(
  Object.entries(organizationTypes).map(([key, value]) => [
    key,
    { label: value.label, mods: value.modules },
  ]),
);
export default function NewOrg() {
  const router = useRouter();
  const [step, setStep] = useState(1),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [type, setType] = useState("business"),
    [plan, setPlan] = useState("professional"),
    [email, setEmail] = useState(""),
    [primary, setPrimary] = useState("#138cff"),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const cfg = useMemo(() => configs[type], [type]);
  const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const validEmail =
    !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function goToStep(target: number) {
    if (target <= step) {
      setMsg("");
      setStep(target);
      return;
    }
    if (target === step + 1) advance();
  }
  function advance() {
    setMsg("");
    if (step === 1 && (!name.trim() || !validSlug)) {
      setMsg(
        "Enter an organization name and a URL slug using lowercase letters, numbers and hyphens.",
      );
      return;
    }
    if (step === 2 && !validEmail) {
      setMsg("Enter a valid administrator email, or leave it blank.");
      return;
    }
    setStep((v) => Math.min(4, v + 1));
  }
  function nameChanged(v: string) {
    setName(v);
    setSlug(
      v
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (!name.trim() || !validSlug || !validEmail) {
      setMsg(
        "Check the organization name, URL slug, and administrator email before continuing.",
      );
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const {
        data: { user },
        error: authError,
      } = await sb.auth.getUser();
      if (authError || !user)
        throw new Error("Your session has expired. Please sign in again.");
      const { data: id, error } = await sb.rpc("v11_create_organization", {
        org_name: name.trim(),
        org_slug: slug,
        org_type: type,
        org_plan: plan,
        color: primary,
        admin_email: email.trim().toLowerCase(),
        module_keys: cfg.mods,
      });
      if (error) throw error;
      router.push("/clubs/" + id + "/launch");
    } catch (err: any) {
      setMsg(
        err?.message || "Unable to create the organization. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="v6PageHead">
        <div>
          <div className="eyebrow cyan">
            NADORIO v11 · ORGANIZATION ONBOARDING
          </div>
          <h1>Create an Organization</h1>
          <p>
            Set up a business, nonprofit, school, association, club, or
            community using one flexible platform. Modules are recommendations,
            not restrictions.
          </p>
        </div>
        <div className="v6Badge">
          <Sparkles /> Step {step} of 4
        </div>
      </div>
      <form className="form onboardingForm v6Onboarding" onSubmit={submit}>
        <div className="v6Steps">
          {["Organization", "Platform", "Branding", "Launch"].map((x, i) => (
            <button
              type="button"
              className={step === i + 1 ? "active" : ""}
              onClick={() => goToStep(i + 1)}
              aria-current={step === i + 1 ? "step" : undefined}
              disabled={i + 1 > step + 1}
              key={x}
            >
              <span>{i + 1}</span>
              {x}
            </button>
          ))}
        </div>
        {step === 1 && (
          <>
            <div className="field">
              <label>Organization name</label>
              <input
                value={name}
                onChange={(e) => nameChanged(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Organization URL slug</label>
              <input
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
              />
            </div>
            <div className="field">
              <label>Organization type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(configs).map(([k, v]: any) => (
                  <option value={k} key={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="field">
              <label>NADORIO plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="v6Recommended">
              <Check />
              <div>
                <b>Recommended for {cfg.label}</b>
                <p>{cfg.mods.join(" · ")}</p>
              </div>
            </div>
            <div className="field">
              <label>
                First administrator email <small>(optional)</small>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="field">
              <label>Primary brand color</label>
              <div className="colorField">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                />
                <input
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                />
              </div>
            </div>
            <div
              className="v6BrandPreview"
              style={{ "--preview": primary } as any}
            >
              <span>POWERED BY NADORIO</span>
              <h2>{name || "Your Organization"}</h2>
              <p>A branded portal, powered by one secure platform.</p>
            </div>
          </>
        )}
        {step === 4 && (
          <div className="v6Launch">
            <Building2 />
            <h2>{name || "New organization"} is ready for setup.</h2>
            <p>
              {cfg.label} · NADORIO {plan} · {cfg.mods.length} recommended
              modules
            </p>
            <div className="onboardNote">
              <Check /> Recommended modules will be licensed but inactive. Send
              the saved administrator invitation from People & Access.
            </div>
          </div>
        )}
        {msg && <div className="error">{msg}</div>}
        <div className="v6WizardActions">
          {step > 1 && (
            <button
              type="button"
              className="button"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="button gradient" onClick={advance}>
              Continue <ChevronRight />
            </button>
          ) : (
            <button className="button gradient" disabled={busy}>
              <Building2 />
              {busy ? "Creating…" : "Create Organization"}
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}
