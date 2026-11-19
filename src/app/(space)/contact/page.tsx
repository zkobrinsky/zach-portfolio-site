import { ContactForm } from "@/components/ContactForm";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/contact");

export default function ContactPage() {
  return <ContactForm />;
}
