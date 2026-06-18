import { ProfileForm } from "@/components/dashboard/profile-form";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfilePage() {
  const current = await getCurrentUser();
  const profile = JSON.parse(
    JSON.stringify({
      email: current?.user.email ?? "",
      fullName: current?.profile?.fullName ?? "",
      addressLine1: current?.profile?.addressLine1 ?? "",
      addressLine2: current?.profile?.addressLine2 ?? "",
      city: current?.profile?.city ?? "",
      state: current?.profile?.state ?? "",
      postalCode: current?.profile?.postalCode ?? "",
      country: current?.profile?.country ?? "",
      phone: current?.profile?.phone ?? "",
      dateOfBirth: current?.profile?.dateOfBirth ?? ""
    })
  );

  return <ProfileForm profile={profile} />;
}
