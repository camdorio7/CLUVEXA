"use client";
import { useWorkspace } from "../../../../components/WorkspaceShell";
import OrganizationOnboarding from "../../../../components/OrganizationOnboarding";
export default function Page() {
  const { club } = useWorkspace();
  return <OrganizationOnboarding id={club.id} />;
}
