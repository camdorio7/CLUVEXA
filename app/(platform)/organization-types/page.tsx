import { organizationTypes } from "../../../lib/organization-types";
import { modules } from "../../../lib/modules";
export default function Page() {
  return (
    <>
      <div className="top">
        <div>
          <h1>Organization types</h1>
          <p>
            Shared terminology and module recommendations. Organization
            administrators can customize their licensed features.
          </p>
        </div>
      </div>
      <div className="v11Grid">
        {Object.entries(organizationTypes).map(([key, type]) => (
          <section className="panel" key={key}>
            <h2>{type.label}</h2>
            <p>People are called “{type.memberLabel}”.</p>
            <p>
              {type.modules
                .map((k) => modules.find((m) => m.key === k)?.name || k)
                .join(" · ")}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
