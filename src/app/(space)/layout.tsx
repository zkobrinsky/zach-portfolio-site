import { SpaceExperience } from "@/components/space/SpaceExperience";
import { preloadScene } from "@/lib/space/assets";

/** Space stays mounted across routes; each route's page content slots in here. */
export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  // Hinted from the layout, not a page: a layout renders for a fresh visit but isn't fetched again when you
  // navigate, so the hints can't come back later for files the scene has already loaded, and go unused.
  preloadScene();
  return (
    <main>
      <SpaceExperience>{children}</SpaceExperience>
    </main>
  );
}
