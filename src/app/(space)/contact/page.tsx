import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact | Zach Kobrinsky" };

export default function ContactPage() {
  return (
    <>
      <h2>Contact</h2>
      <p>
        <a href="mailto:zachkobrinsky@gmail.com">zachkobrinsky@gmail.com</a>
      </p>
    </>
  );
}
