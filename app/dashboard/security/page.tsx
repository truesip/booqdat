import { SecurityForm } from "@/components/dashboard/security-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SecurityPage() {
  const current = await getCurrentUser();
  return <SecurityForm email={current?.user.email ?? ""} />;
}
