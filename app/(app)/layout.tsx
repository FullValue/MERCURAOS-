import { exigerUtilisateur } from "@/lib/auth";
import { BarreLaterale } from "@/components/layout/BarreLaterale";

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigerUtilisateur();

  return (
    <div className="min-h-screen">
      <BarreLaterale />
      <div className="lg:pl-[220px]">
        <main className="max-w-[1100px] px-5 py-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
