import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact | Zach Kobrinsky" };

export default function ContactPage() {
  return (
    <>
      <h2>Contact</h2>
      <ContactForm />
    </>
  );
}
