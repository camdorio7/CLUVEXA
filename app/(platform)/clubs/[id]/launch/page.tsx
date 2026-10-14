"use client";
import { useParams } from "next/navigation";
import OrganizationOnboarding from "../../../../../components/OrganizationOnboarding";
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <OrganizationOnboarding id={id} />;
}
