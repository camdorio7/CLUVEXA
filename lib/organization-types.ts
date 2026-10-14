export type OrganizationType = {
  label: string;
  memberLabel: string;
  serviceLabel: string;
  modules: string[];
};
const core = [
  "members",
  "memberships",
  "events",
  "communications",
  "website_builder",
  "email_center",
];
const define = (
  label: string,
  extras: string[] = [],
  memberLabel = "Members",
  serviceLabel = "Organization services",
): OrganizationType => ({
  label,
  memberLabel,
  serviceLabel,
  modules: [...new Set([...core, ...extras])],
});

/** Recommendations only: licensing and explicit permissions always determine access. */
export const organizationTypes: Record<string, OrganizationType> = {
  private_club: define(
    "Country / Private Club",
    [
      "golf",
      "tee_sheet",
      "amenities",
      "access",
      "staff",
      "operations",
      "reports",
    ],
    "Members",
    "Club services",
  ),
  golf_club: define(
    "Golf Club",
    ["golf", "tee_sheet", "access", "staff", "reports"],
    "Members",
    "Golf & club services",
  ),
  hoa: define(
    "HOA / Condominium",
    ["amenities", "access", "operations", "reports"],
    "Residents",
    "Community services",
  ),
  nonprofit: define("Nonprofit", ["staff", "reports"], "Members & volunteers"),
  education: define(
    "School / Education",
    ["staff", "access", "reports"],
    "Community members",
  ),
  sports: define("Sports Organization", ["amenities", "staff", "access"]),
  community: define("Community Organization", ["access"]),
  business: define(
    "Business / Company",
    ["staff", "operations", "reports"],
    "People",
  ),
  professional: define(
    "Professional Services",
    ["staff", "operations", "reports"],
    "People",
  ),
  association: define("Membership Association", ["reports"]),
  yacht: define("Yacht / Boating Club", ["amenities", "staff", "access"]),
  fitness: define("Fitness / Racquet Club", ["amenities", "staff", "access"]),
  recreation: define("Recreation Facility", ["amenities", "staff", "access"]),
  hospitality: define("Hospitality / Resort", [
    "amenities",
    "staff",
    "operations",
  ]),
  other: define("General Organization", ["operations"]),
};
export function getOrganizationType(key?: string | null): OrganizationType {
  const aliases: Record<string, string> = {
    golf_country: "private_club",
    country_club: "private_club",
    school: "education",
    golf: "golf_club",
  };
  return (
    organizationTypes[aliases[key || ""] || key || "other"] ||
    organizationTypes.other
  );
}
