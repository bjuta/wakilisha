import TaxonomyTermsPage from "../components/TaxonomyTermsPage";

export default function AdminCategoriesPage() {
  return (
    <TaxonomyTermsPage
      title="Categories"
      subtitle="Manage article categories."
      taxonomy="category"
      icon="FolderTree"
    />
  );
}