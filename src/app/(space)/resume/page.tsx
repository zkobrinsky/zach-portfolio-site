import Link from "next/link";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/resume");

const SKILLS = [
  ["Frontend", "TypeScript · JavaScript · HTML/CSS · Vue.js · Nuxt.js · React · Next.js · Angular · Tailwind · Bootstrap · SASS"],
  ["Graphics & Animation", "Three.js · WebGL · GSAP · SVG Animation · Figma · Spline · Photoshop · Canvas 2D · p5.js · Konva.js"],
  ["Tools & Infrastructure", "Docker · Webpack · Vite · Node.js · AWS · S3 · PostgreSQL · WebSockets · WebRTC · Jest · Playwright"],
];

type Bullet = { text: string; details?: string[] };

const JOBS: { company: string; role: string; dates: string; bullets: Bullet[] }[] = [
  {
    company: "Kargo",
    role: "Senior Software Engineer",
    dates: "2026–Present",
    bullets: [
      {
        text: "Built reusable creative templates for “Karlo,” an AI-powered advertising platform, supporting resizing and versioning across placements, reusable JavaScript animations, and scalable CSS recreations of static creative assets",
      },
      {
        text: "Worked across dozens of repositories spanning advertising products, publisher integrations, internal tools, and creative platforms, adapting quickly to different frameworks and codebases",
      },
      {
        text: "Investigated production issues across publisher pages using browser DevTools, network inspection, DOM analysis, and internal tools",
      },
      {
        text: "Tech Lead on “Flourishes,” interactive elements added to open-web and PMP banner ads to increase engagement, driving CTR lifts of up to 160%",
        details: [
          "Built a dynamic color-extraction pipeline that navigated CORS restrictions and varied creative formats to identify visual assets for color quantization; used Open Graph metadata for advertiser-specific styling",
          "Migrated “Flourishes” from an S3-hosted CSS lookup to a manifest system bundling configuration, CTA text, CSS, and JavaScript—cutting deployment time from 1.5–2 weeks to one day and eliminating ad-tag releases",
        ],
      },
    ],
  },
  {
    company: "StoragePug",
    role: "Senior Frontend Developer",
    dates: "2023–2026",
    bullets: [
      {
        text: "Architected and spearheaded the development of an interactive 3D application alongside its complementary 2D canvas tool",
        details: [
          "Utilized Three.js/WebGL with algebraic & trigonometric calculations for advanced spatial interactions",
          "Engineered a dynamic interface between canvas-rendered graphics and traditional DOM elements, creating a seamless, cohesive app across disparate coding environments",
          "Took the application from initial concept through production-ready release",
        ],
      },
      { text: "Prototyped a Voice AI agent service, leveraging LLMs to create dynamic, conversational user experiences" },
    ],
  },
  {
    company: "Buzzfeed / Complex Networks",
    role: "Web Developer",
    dates: "2021–2023",
    bullets: [
      { text: "Built and delivered 100+ ad campaigns, 20 websites, generating over $3 million in development revenue" },
      {
        text: "Improved, optimized, innovated and maintained proprietary developer tools, and developed automation scripts, increasing workflow efficiency by as much as 1,200%",
      },
      {
        text: "Collaborated with project managers, designers and clients, translating code into palatable language, and converting client wants and designs into responsive web development",
      },
    ],
  },
];

const CREATIVE = [
  "Diadeis / SGS Global — Senior Retoucher (2019–2020)",
  "Revlon — Photographer, Retoucher (2018–2019)",
  "National Geographic Magazine — Photographic Assistant, Contributing Photographer, Retoucher (2011–2017)",
];

const EDUCATION = [
  ["Flatiron School", "Full Stack Web Development"],
  ["New York University Tisch School of the Arts", "Interactive Telecommunications Program"],
  ["Minnesota State University Moorhead", "Bachelor of Science, Mass Communications, photo and print journalism"],
];

export default function ResumePage() {
  return (
    <div className={styles.resume}>
      <h2>Zach Kobrinsky</h2>
      <nav className={styles.links} aria-label="Get in touch">
        <span>Brooklyn, NY</span>
        <Link href="/contact">Contact</Link>
        <a href="https://www.linkedin.com/in/zkobrinsky" target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
      </nav>
      <p>
        Senior Frontend Engineer with 8+ years of experience building interactive 2D and 3D applications, complex UI
        systems, and visually rich web experiences. Two decades of experience in photography, visual storytelling,
        editorial production, and creative media, bringing a distinctive visual sensibility to frontend engineering and
        digital product development. Former National Geographic contributing photographer. Former newspaper editor. Former
        fishmonger.
      </p>

      <h3>Technical Skills</h3>
      <dl className={styles.skills}>
        {SKILLS.map(([area, tools]) => (
          <div key={area}>
            <dt>{area}</dt>
            <dd>{tools}</dd>
          </div>
        ))}
      </dl>

      <h3>Work Experience</h3>
      {JOBS.map(({ company, role, dates, bullets }) => (
        <section key={company} className={styles.job}>
          <header>
            <h4>
              {company} <em>{role}</em>
            </h4>
            <time>{dates}</time>
          </header>
          <ul>
            {bullets.map(({ text, details }) => (
              <li key={text}>
                {text}
                {details && (
                  <ul>
                    {details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className={styles.job}>
        <header>
          <h4>Photography, Visual Storytelling &amp; Creative Media</h4>
        </header>
        <ul>
          {CREATIVE.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </section>

      <h3>Education</h3>
      <ul className={styles.education}>
        {EDUCATION.map(([school, program]) => (
          <li key={school}>
            <strong>{school}</strong> {program}
          </li>
        ))}
      </ul>
    </div>
  );
}
