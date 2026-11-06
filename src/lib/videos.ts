export type Video = {
  /** A Vimeo video's id, or a name for one of our own files. Its thumbnail is public/videos/<id>.jpg. */
  id: string;
  title: string;
  caption?: string;
  /** Set for a silent clip hosted here instead of on Vimeo. It plays on a loop. */
  file?: string;
};

export const VIDEOS: Video[] = [
  {
    id: "271147650",
    title: "Slug Skin",
    caption: "The undulating skin of a Leopard Slug, Limax maximus. Music by Aryeh Kobrinsky.",
  },
  {
    id: "238282006",
    title: "Dancing Worm Sex Organ",
    caption:
      "A Syllid epitoke from the San Francisco Bay in a drop of water. These marine worms, in order to avoid predation, have evolved a defense mechanism where they grow autonomous sex organs that grow their own heads and eyes called epitokes. The epitokes have sex on the parent worm's behalf while the parent worm stays safe and sound.",
  },
  {
    id: "282722890",
    title: "Caterpillar Waltz",
    caption: "You know your flowers are organic when they're covered in cute critters. Inchworms, family Geometridae.",
  },
  { id: "272660998", title: "Beetle Dance", caption: "Brooklyn beetle dances to Hush Point." },
  {
    id: "parasitic-anemone-time-lapse",
    title: "Parasitic Anemone Time Lapse",
    file: "/videos/parasitic-anemone-time-lapse.mp4",
  },
  {
    id: "295184546",
    title: "Autonomous Reef Monitoring Structures",
    caption: "How scientists are measuring biodiversity and changes in the ocean using accessible methods.",
  },
  {
    id: "201874957",
    title: "Jered's Pottery Promo",
    caption: "Jered's Pottery California Promotional Video — footage and editing by Zachariah Kobrinsky",
  },
  {
    id: "273192020",
    title: "BKCM Music Partners",
    caption: "Promo for the Music Partners Program at the Brooklyn Conservatory of Music",
  },
  { id: "238468680", title: "Brooklyn Conservatory of Music Community Outreach" },
];
