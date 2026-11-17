import { pageMetadata } from "@/lib/seo";
import { preloadScene } from "@/lib/space/assets";

export const metadata = pageMetadata("/");

/** The root route is space itself, so there's no page content. */
export default function Home() {
  preloadScene({ withHead: false });
  return null;
}
