import { requireRole } from "@/lib/require-role";
import JobForm from "@/components/job-form";

export default async function NewJobPage() {
  await requireRole("employer");

  return <JobForm />;
}
