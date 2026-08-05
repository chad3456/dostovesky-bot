import { PodcastDetail } from "@/components/epubcast/podcast-detail";

export default function PodcastPage({ params }: { params: { id: string } }) {
  return <PodcastDetail podcastId={params.id} />;
}
