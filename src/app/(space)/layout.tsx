import { SpaceExperience } from "@/components/space/SpaceExperience";

/** Space stays mounted across routes; each route's page content slots in here. */
export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <SpaceExperience>{children}</SpaceExperience>
    </main>
  );
}
