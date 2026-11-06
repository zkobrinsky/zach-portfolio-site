import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { pageMetadata } from "@/lib/seo";
import styles from "./page.module.css";

export const metadata = pageMetadata("/projects/martian-weather-service");

export default function MartianWeatherServicePage() {
  return (
    <div className={styles.project}>
      <h2>Martian Weather Service</h2>
      <p>
        My first coding school project, from Flatiron School in 2020: a Ruby command line app that compares the weather on
        Mars with the weather where you are. Enter a zip code, and it shows your current weather next to the latest reading
        from NASA’s InSight lander.
      </p>
      <p>
        It’s really a morale booster. Think your forecast is grim? Take a look at Mars and count your blessings. At least
        it’s not 200 below.
      </p>
      <YouTubeEmbed id="FrRm201wcKw" title="Martian Weather Service walkthrough" />
      <p className={styles.note}>Please forgive the bad audio.</p>
      <h3>The technical work</h3>
      <ul>
        <li>Turns a zip code into a latitude and longitude, to query a historical Earth weather API.</li>
        <li>Pulls the five most recent days of Mars weather from the InSight API.</li>
        <li>Stores both planets’ data by Earth day in a Day class, so any day can be compared side by side.</li>
        <li>A menu lets you change the zip code and browse forecasts, archived weather, and current conditions for either planet.</li>
      </ul>
    </div>
  );
}
