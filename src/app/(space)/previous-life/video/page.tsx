import { VideoGallery } from "@/components/VideoGallery";
import { pageMetadata } from "@/lib/seo";
import { VIDEOS } from "@/lib/videos";

export const metadata = pageMetadata("/previous-life/video");

export default function VideoPage() {
  return (
    <>
      <h2>Video</h2>
      <VideoGallery videos={VIDEOS} />
    </>
  );
}
