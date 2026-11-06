import Image from "next/image";
import { draftMetadata } from "@/lib/seo";

export const metadata = draftMetadata("Kargo Flourishes");

export default function KargoPage() {
  return (
    <>
      <Image
        src="/projects/kargo-logo.svg"
        alt="Kargo"
        width={214}
        height={80}
        unoptimized
        style={{ margin: "0 auto 28px", height: "auto" }}
      />
      <h2>Kargo Flourishes</h2>
      <p>Coming soon.</p>
    </>
  );
}
