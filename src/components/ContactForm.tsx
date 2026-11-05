"use client";

import { type FormEvent, useRef, useState } from "react";
import styles from "./ContactForm.module.css";

type Status = "idle" | "sending" | "sent" | "failed";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, startedAt: startedAt.current }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (result?.ok) return setStatus("sent");
    setError(result?.error ?? "Something went wrong sending that. Please try again.");
    setStatus("failed");
  };

  if (status === "sent") return <p role="status">Message received. Thanks for reaching out.</p>;

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      onFocus={() => {
        startedAt.current ||= Date.now();
      }}
    >
      <label>
        Name
        <input name="name" required maxLength={100} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label>
        Message
        <textarea name="message" required maxLength={5000} rows={6} />
      </label>
      {/* hidden from people; bots fill it in */}
      <label className={styles.trap} aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {status === "failed" && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending" : "Send"}
      </button>
    </form>
  );
}
