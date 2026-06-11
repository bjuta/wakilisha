import TaxonomyTermsPage from "../components/TaxonomyTermsPage";

export default function AdminTagsPage() {
  return (
    <TaxonomyTermsPage
      title="Tags"
      subtitle="Manage article tags."
      taxonomy="post_tag"
      icon="Tags"
    />
  );
}