import { requireRole } from "@/lib/require-role";
import NewJobForm from "@/components/new-job-form";

export default async function NewJobPage() {
  await requireRole("employer");

  return <NewJobForm />;
}
