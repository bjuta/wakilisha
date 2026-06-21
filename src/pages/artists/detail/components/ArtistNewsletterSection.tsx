import { useScrollReveal } from "@/hooks/useScrollReveal";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";

interface ArtistNewsletterSectionProps {
  artistName: string;
  artistSlug: string;
}

export function ArtistNewsletterSection({ artistName, artistSlug }: ArtistNewsletterSectionProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <NewsletterSubscribe
        formAction="https://readdy.ai/api/form/d8qhqude8ise6dlc8d70"
        formId="artist-newsletter-form"
        headline={`Follow ${artistName}.`}
        description="Get updates when new releases, chart entries, and stories drop."
        contextFields={{ artistSlug, artistName, wk_page_type: "artist_detail" }}
        analytics={{
          pageType: "artist_detail",
          entitySlug: artistSlug,
          entityType: "artist",
        }}
      />
    </section>
  );
}