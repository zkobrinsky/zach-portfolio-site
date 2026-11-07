import Image from "next/image";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/publications");

type Photo = { src: string; alt: string; width: number; height: number; caption: string };
type Item = { title: string; detail: string; url?: string; photo?: Photo };

const SECTIONS: { heading: string; items: Item[] }[] = [
  {
    heading: "Articles",
    items: [
      {
        title: "“Margelopsid species search taxonomic home within Corymorphidae and Boreohydridae”",
        detail: "PeerJ (2023). Co-author",
        url: "https://peerj.com/articles/16265/",
      },
      {
        title: "“Jellyfish: Scary, Squishy, Brainless, Beautiful”",
        detail: "National Geographic magazine, October 2018 (photo and video)",
        url: "https://www.nationalgeographic.com/magazine/article/jellyfish-species-reproduction-feeding-ocean",
      },
      {
        title: "“A New Species of Pea Crab of the Genus Serenotheres”",
        detail: "ZooKeys. Photographs of the holotype of the recently described species Serenotheres janus (2016)",
        url: "https://doi.org/10.3897/zookeys.623.10272",
      },
      {
        title: "“New Parasitic Crab Species Discovered During Smithsonian Biocube Work in Solomon Islands”",
        detail: "Smithsonian Insider (2016)",
        url: "https://insider.si.edu/2016/12/new-solomon-islands-crab-species-discovered-biocube-research/",
      },
      {
        title: "“Ruby and Me”",
        detail: "Retouching for Ursula K. Le Guin (2010). Removed bystanders from the background of her portrait with Ruby the turkey vulture, published on her blog",
        url: "https://www.ursulakleguin.com/blog/105-ruby-and-me",
      },
    ],
  },
  {
    heading: "Books",
    items: [
      {
        title: "Octopus, Seahorse, Jellyfish",
        detail: "By David Liittschwager, National Geographic (2022). Several of the octopus photos, credited in the acknowledgments",
        url: "https://www.amazon.com/dp/1426221797",
      },
    ],
  },
  {
    heading: "Exhibits",
    items: [
      {
        title: "“Life in One Cubic Foot”",
        detail: "Exhibit at Smithsonian (2016–2018). Retouching and print preparation for the exhibit",
        url: "https://www.si.edu/newsdesk/releases/smithsonian-exhibition-life-one-cubic-foot-dives-mosaic-life-around-globe-starting-march-4",
        photo: {
          src: "/photos/life-in-one-cubic-foot-brothers.jpg",
          alt: "Zach Kobrinsky and his two brothers posing in front of a wall of photographed sea creatures at the Life in One Cubic Foot exhibit",
          width: 1400,
          height: 1050,
          caption: "My brothers and me in the exhibit.",
        },
      },
    ],
  },
  {
    heading: "Video",
    items: [
      {
        title: "“Autonomous Reef Monitoring Structures”",
        detail: "Promotional video, Smithsonian Ocean Portal",
        url: "https://vimeo.com/295184546",
      },
      { title: "“One Cubic Foot”", detail: "Educational videos. Camera operator, sound (2014)" },
    ],
  },
  {
    heading: "Talks",
    items: [
      {
        title: "“Autonomous Sex Organs and Other Strange Phenomena”",
        detail: "Speaker, New York Aquarium’s Summer Nights 2019",
      },
      { title: "“Art at the Zoo”", detail: "Speaker, Seneca Park Zoo, Rochester (2017)" },
    ],
  },
];

export default function PublicationsPage() {
  return (
    <div className={styles.publications}>
      <h2>Publications</h2>
      {SECTIONS.map(({ heading, items }) => (
        <section key={heading}>
          <h3>{heading}</h3>
          <ul>
            {items.map(({ title, detail, url, photo }) => (
              <li key={title}>
                <strong>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </strong>
                {detail}
                {photo && (
                  <figure>
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      sizes="20rem"
                    />
                    <figcaption>{photo.caption}</figcaption>
                  </figure>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
