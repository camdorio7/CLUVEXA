// Deterministic browser-test fixture only. Database RLS is exercised separately in PostgreSQL.
import { createServer } from "node:http";
const clubId = "20000000-0000-0000-0000-000000000001";
const keys = [
  "members",
  "memberships",
  "events",
  "golf",
  "staff",
  "operations",
  "communications",
  "website_builder",
  "email_center",
  "access",
  "reports",
  "amenities",
];
const names = {
  members: "Members",
  golf: "Golf & tournaments",
  website_builder: "Website Builder",
  events: "Events",
};
createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,prefer,range,x-supabase-api-version,accept-profile,content-profile,x-retry-count",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,HEAD,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "content-range");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:54321");
  let claims = {};
  try {
    claims = JSON.parse(
      Buffer.from(
        (req.headers.authorization || "").split(".")[1] || "",
        "base64url",
      ).toString(),
    );
  } catch {}
  let input = {};
  if (req.method === "POST" || req.method === "PUT") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      input = JSON.parse(raw || "{}");
    } catch {}
  }
  const persona = claims.test_role || "visitor";
  const role =
    persona === "super"
      ? "super_admin"
      : ["disabled", "inactive", "hoa"].includes(persona)
        ? "member"
        : persona;
  const user = {
    id: claims.sub || "10000000-0000-0000-0000-000000000004",
    email: `${persona}@example.test`,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    email_confirmed_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  };
  const club = {
    id: clubId,
    name: persona === "hoa" ? "Harbor Community" : "Pine Valley Club",
    organization_type: persona === "hoa" ? "hoa" : "golf_club",
    status: persona === "inactive" ? "suspended" : "active",
    primary_color: "#275e72",
    plan: "professional",
    subscription_status: "unconfigured",
    checkin_activities: ["General", "Practice"],
    logo_url: null,
  };
  let data = [];
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (
      (grant === "pkce" &&
        input.auth_code === "valid-recovery-code" &&
        input.code_verifier === "fixture-verifier") ||
      (grant === "password" &&
        input.email === "member@example.test" &&
        input.password === "valid-password")
    ) {
      const claims = {
        sub: user.id,
        role: "authenticated",
        aud: "authenticated",
        test_role: "member",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token =
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ) +
        "." +
        Buffer.from(JSON.stringify(claims)).toString("base64url") +
        ".testsignature";
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { ...user, email: "member@example.test" },
        }),
      );
      return;
    }
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid or expired credentials",
      }),
    );
    return;
  }
  if (url.pathname === "/auth/v1/signup") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ...user,
        email: input.email,
        email_confirmed_at: null,
        identities: [{ id: user.id }],
      }),
    );
    return;
  }
  if (url.pathname === "/auth/v1/recover") {
    res.setHeader("Content-Type", "application/json");
    res.end("{}");
    return;
  }

  if (url.pathname === "/auth/v1/user") {
    data = user;
  } else if (url.pathname === "/rest/v1/rpc/get_public_club_invitation") {
    data =
      input.invite_token === "40000000-0000-0000-0000-000000000001"
        ? [
            {
              email: "member@example.test",
              full_name: "Alex Morgan",
              club_name: "Pine Valley Club",
            },
          ]
        : [];
  } else if (url.pathname === "/rest/v1/rpc/accept_club_invitation") {
    data = clubId;
  } else if (url.pathname === "/rest/v1/rpc/is_super_admin") {
    data = persona === "super";
  } else if (url.pathname === "/rest/v1/rpc/v11_event_counts") {
    data = [];
  } else if (url.pathname === "/rest/v1/rpc/v11_public_site") {
    data = {
      club_id: clubId,
      title: "A place to belong",
      tagline: "Connect with your community.",
      about:
        "An independent organization with a welcoming place for every member.",
      services: ["Membership", "Community events"],
      published: true,
      pages: [
        {
          slug: "about",
          title: "About us",
          body: "Our organization brings people together.",
        },
      ],
    };
  } else if (url.pathname === "/rest/v1/rpc/v11_public_branding") {
    data = [{ name: club.name, primary_color: club.primary_color }];
  } else if (url.pathname === "/rest/v1/clubs") {
    data =
      url.searchParams.get("id") && !url.searchParams.get("id").endsWith(clubId)
        ? []
        : [club];
  } else if (url.pathname === "/rest/v1/club_users") {
    data =
      url.searchParams.get("club_id") &&
      !url.searchParams.get("club_id").endsWith(clubId)
        ? []
        : [
            {
              id: "membership-1",
              club_id: clubId,
              user_id: user.id,
              role,
              active: true,
              clubs: club,
              profiles: { full_name: "Alex Morgan", email: user.email },
            },
          ];
  } else if (url.pathname === "/rest/v1/club_modules") {
    data = keys.map((module_key) => ({
      module_key,
      licensed: !(
        module_key === "golf" && ["disabled", "hoa"].includes(persona)
      ),
      club_enabled: true,
      member_visible: true,
      nav_label: null,
    }));
  } else if (url.pathname === "/rest/v1/module_catalog") {
    data = keys.map((module_key) => ({
      module_key,
      name: names[module_key] || module_key,
      available: true,
      compatible_types: [],
      sort_order: 1,
    }));
  } else if (url.pathname === "/rest/v1/club_user_permissions") {
    data =
      role === "staff"
        ? [
            {
              module_key: "operations",
              can_view: true,
              can_create: false,
              can_edit: false,
              can_delete: false,
            },
          ]
        : [];
  } else if (url.pathname === "/rest/v1/profiles") {
    data = [
      {
        ...user,
        full_name: "Alex Morgan",
        platform_role: persona === "super" ? "super_admin" : "user",
      },
    ];
  } else if (url.pathname === "/rest/v1/members") {
    data =
      role === "member"
        ? [
            {
              id: "member-1",
              profile_id: user.id,
              full_name: "Alex Morgan",
              member_number: "1004",
              good_standing: true,
              status: "active",
              membership_types: { name: "Full member" },
            },
          ]
        : [];
  } else if (url.pathname === "/rest/v1/operational_tasks") {
    data = [
      {
        id: "task-1",
        title: "Prepare meeting room",
        status: "open",
        priority: "normal",
      },
    ];
  }
  if (req.headers.prefer?.includes("count=exact"))
    res.setHeader(
      "Content-Range",
      `0-0/${Array.isArray(data) ? data.length : 1}`,
    );
  if (req.method === "HEAD") {
    res.setHeader(
      "Content-Range",
      `0-0/${Array.isArray(data) ? data.length : 1}`,
    );
    res.writeHead(200);
    res.end();
    return;
  }
  if (
    (req.headers.accept || "").includes("application/vnd.pgrst.object+json") &&
    Array.isArray(data)
  )
    data = data[0] || null;
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(JSON.stringify(data));
}).listen(54321, "127.0.0.1");
