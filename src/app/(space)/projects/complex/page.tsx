import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/projects/complex");

const STORY_URL = "https://www.complex.com/music/a/eric-skelton/kanye-west-changed-music";

const MORE_WORK: { title: string; detail: string; url?: string; image: string }[] = [
  {
    title: "She-Hulk",
    detail:
      "A stunt and content filter for Disney. The Hulk creative hacks the publisher’s page and turns its inline images and text green.",
    url: "https://www.complex.com/?democampaign=disney-she-hulk-content-filter-08-2022_content-filter-button-v2",
    image: "/projects/complex/she-hulk.jpg",
  },
  {
    title: "Kerwin Frost’s Coca-Cola Dreamworld",
    detail:
      "A 3D digital playground where you could step inside Kerwin Frost’s mind, customize your own Dreamworld, and snap a photo. The site is gone now, so this image is put together from the art that survived.",
    image: "/projects/complex/dreamworld.jpg",
  },
  {
    title: "See You Next Year",
    detail: "The Pigeons & Planes x Big. Ass. Kids album site, including the cool flying animation using sprites.",
    url: "https://www.seeunextyear.com/",
    image: "/projects/complex/see-you-next-year.jpg",
  },
  {
    title: "Saks Fifth Avenue",
    detail: "An editorial shopping experience that I templatized.",
    url: "https://partner.complex.com/saks-fifth-avenue-designer-must-haves-this-fall",
    image: "/projects/complex/saks.jpg",
  },
  {
    title: "Alienware x Bodega",
    detail: "I made a lot of these sweepstakes pages in the olden days with PHP.",
    url: "https://partner.complex.com/alienware",
    image: "/projects/complex/alienware.jpg",
  },
  {
    title: "Black Panther: Wakanda Forever",
    detail: "An animated mobile campaign for Disney.",
    url: "https://partner.complex.com/mobile-preview/?democampaign=disney-wakanda-forever-09-2022_mobile-animated",
    image: "/projects/complex/wakanda.jpg",
  },
  {
    title: "Crest 3D White",
    detail: "An interactive mobile ad demo with a filter.",
    url: "https://partner.complex.com/mobile-preview/?democampaign=crest-bzfd-filter-demo-09-2022_mobile",
    image: "/projects/complex/crest.jpg",
  },
  {
    title: "Swagger on Apple TV+",
    detail: "A jumbotron ad with a built-in photo gallery and video player that you can switch between. Scroll down to see it.",
    url: "https://www.complex.com/?democampaign=apple-tv-swagger-10-2021_jumbotron",
    image: "/projects/complex/swagger.jpg",
  },
  {
    title: "Dell Alienware",
    detail: "A banner with a product carousel and scrolling marquee, promoting the Alienware x Bodega sweepstakes. Scroll down to see it.",
    url: "https://www.complex.com/?democampaign=dell-alienware-fy22-09-2021_to",
    image: "/projects/complex/dell-alienware.jpg",
  },
  {
    title: "Timberland",
    detail: "An animated banner with sound for Timbs Trails, with six themed panels. Scroll down to see it.",
    url: "https://www.complex.com/?democampaign=timberland-boot-demo-01-2022_to-animated-no-boot",
    image: "/projects/complex/timberland.jpg",
  },
  {
    title: "Banana Republic",
    detail: "A banner with a smooth-scrolling lookbook of the fall collection. Scroll down to see it.",
    url: "https://www.complex.com/?democampaign=banana-republic-fall-harlem-fashion-09-2021_ros-smoother",
    image: "/projects/complex/banana-republic.jpg",
  },
];

const MARTIN_URL = "https://partner.complex.com/bet-martin-reunion";

function Card({ title, detail, image }: { title: string; detail: string; image: string }) {
  return (
    <>
      <span className={styles.preview}>
        <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, 21rem" />
      </span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </>
  );
}

export default function ComplexPage() {
  return (
    <div className={styles.project}>
      <h2>
        <Image className={styles.logo} src="/projects/complex/complex-logo.svg" alt="Complex" width={777} height={200} unoptimized />
      </h2>
      <p>I created “How Ye Changed Music” for Complex’s 20th Anniversary cover story.</p>
      <a href={STORY_URL} target="_blank" rel="noopener noreferrer" className={styles.story}>
        <Image
          src="/projects/complex-how-ye-changed-music.jpg"
          alt="How Ye Changed Music, from Complex’s 20th Anniversary cover story"
          width={1200}
          height={630}
          sizes="(max-width: 700px) 100vw, 42rem"
        />
      </a>
      <p className={styles.note}>
        <strong>An important note:</strong> this was all riiiiiight before he totally lost it and became a vocal antisemite.
        So, regrettably, this did not age well.
      </p>
      <a href={STORY_URL} target="_blank" rel="noopener noreferrer" className={styles.button}>
        See the story
      </a>
      <h3>Choose Your Martin Character</h3>
      <p>A funny little mobile ad I made for the Martin reunion. Tap through to find your Martin match.</p>
      <iframe className={styles.phone} src={MARTIN_URL} title="Choose Your Martin Character" loading="lazy" />
      <h3>More from Complex</h3>
      <ul className={styles.grid}>
        {MORE_WORK.map(({ title, detail, url, image }) => (
          <li key={title}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Card title={title} detail={detail} image={image} />
              </a>
            ) : (
              <div className={styles.lost}>
                <Card title={title} detail={detail} image={image} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
