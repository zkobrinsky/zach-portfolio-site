import type { Metadata } from "next";

export const SITE_URL = "https://zachkobrinsky.com";
export const SITE_NAME = "Zach Kobrinsky";
export const HOME_TITLE = "Zach Kobrinsky | Senior Frontend Engineer";
/** Set by hand, because a page's own openGraph replaces the image Next would otherwise add. */
const SHARE_IMAGE = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "Zach Kobrinsky, Senior Frontend Engineer: an astronaut floating beside a ringed planet during an eclipse",
};

/** Finished pages. Placeholders stay out of here until they have real content, so they aren't indexed. */
export const PAGES = {
  "/": {
    title: HOME_TITLE,
    description:
      "Zach Kobrinsky is a senior frontend engineer building interactive 2D and 3D experiences for the web. Former National Geographic contributing photographer.",
  },
  "/about": {
    title: "About",
    description:
      "Senior Frontend Engineer with 8+ years of experience building interactive 2D and 3D applications, and two decades in photography and visual storytelling.",
  },
  "/resume": {
    title: "Resume",
    description:
      "Resume of Zach Kobrinsky, Senior Frontend Engineer: work at Kargo, StoragePug, and Buzzfeed / Complex Networks, plus technical skills and education.",
  },
  "/contact": { title: "Contact", description: "Get in touch with Zach Kobrinsky." },
  "/publications": {
    title: "Publications",
    description:
      "Publications, exhibits, video, and talks by Zach Kobrinsky, including National Geographic magazine and the Smithsonian.",
  },
  "/previous-life/photography": {
    title: "Photography",
    description: "Photography by Zach Kobrinsky, a former National Geographic contributing photographer.",
  },
  "/previous-life/video": {
    title: "Video",
    description: "Short films and promotional videos by Zach Kobrinsky, from slugs and beetles to reef science.",
  },
  "/previous-life/newspaper-editor": {
    title: "Newspaper Editor",
    description: "Zach Kobrinsky was the editor in chief and photo editor of the High Plains Reader.",
  },
  "/previous-life/fishmongering": {
    title: "Fishmongering",
    description: "Before frontend engineering, Zach Kobrinsky was a fishmonger for Blue Moon Fish in New York City.",
  },
  "/projects/cards-with-friends": {
    title: "Cards with Friends",
    description:
      "A free, browser-based card game platform with live video, built by Zach Kobrinsky with Nuxt, Vue, and WebSockets.",
  },
  "/projects/expanding-universe": {
    title: "The Expanding Universe",
    description: "A p5.js piece that shows red shift and the expanding universe using Sloan Digital Sky Survey images.",
  },
  "/projects/baby-kick-sensor": {
    title: "Baby Kick Sensor",
    description: "An interactive p5.js visualization of baby kicks, made by Zach Kobrinsky in grad school.",
  },
  "/projects/martian-weather-service": {
    title: "Martian Weather Service",
    description: "A Ruby command line app comparing the weather on Mars with the weather where you are, built by Zach Kobrinsky at Flatiron School.",
  },
  "/projects/storagepug": {
    title: "StoragePug",
    description: "An interactive 3D application and 2D canvas tool built with Three.js and WebGL by Zach Kobrinsky. Still under NDA.",
  },
  "/projects/complex": {
    title: "Complex",
    description: "How Ye Changed Music, created by Zach Kobrinsky for Complex's 20th Anniversary cover story.",
  },
  "/projects/kargo": {
    title: "Kargo Flourishes",
    description: "Interactive elements for open-web and PMP banner ads, led by Zach Kobrinsky, driving CTR lifts of up to 160%.",
  },
  "/projects/kaleidoscope-maker": {
    title: "Kaleidoscope Maker",
    description: "A React app for creating kaleidoscopic art, drawn with p5.js and controlled through Redux.",
  },
} as const;

/** Each page sets its own address, or every share and search result would point at the home page. */
export function pageMetadata(path: keyof typeof PAGES): Metadata {
  const { title, description } = PAGES[path];
  const fullTitle = path === "/" ? title : `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, url: path, title: fullTitle, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [SHARE_IMAGE] },
  };
}

/** A page that still needs content: reachable from the nav, but kept out of search results. */
export function draftMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } };
}

/** Tells search engines who the site is about. Contact details stay off on purpose. */
export const PERSON_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  url: SITE_URL,
  jobTitle: "Senior Frontend Engineer",
  sameAs: ["https://www.linkedin.com/in/zkobrinsky", "https://github.com/zkobrinsky"],
};
