import { useScrollReveal } from "@/hooks/useScrollReveal";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import { artistInterest, BRIEFING_SLUGS } from "@/services/audienceSubscriptionService";

interface ArtistNewsletterSectionProps {
  artistName: string;
  artistSlug: string;
}

export function ArtistNewsletterSection({ artistName, artistSlug }: ArtistNewsletterSectionProps) {
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  return (
    <section ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <NewsletterSubscribe
        formId="artist-newsletter-form"
        headline={`Follow ${artistName}.`}
        description="Get Artist Signals when new releases, chart entries, and stories around this artist drop."
        briefingSlugs={BRIEFING_SLUGS.artistSignals}
        sourceForm="artist_follow"
        interests={[
          artistInterest({
            slug: artistSlug,
            name: artistName,
            sourceForm: "artist_follow",
            sourceContext: { source_component: "ArtistNewsletterSection" },
            strength: 80,
          }),
        ]}
        successMessage="You’re in. Check your inbox to confirm Artist Signals."
        contextFields={{ artistSlug, artistName, wk_page_type: "artist_detail" }}
        analytics={{
          pageType: "artist_detail",
          entitySlug: artistSlug,
          recordType: "artist",
          context: {
            briefing_slugs: BRIEFING_SLUGS.artistSignals,
            source_form: "artist_follow",
          },
        }}
      />
    </section>
  );
}