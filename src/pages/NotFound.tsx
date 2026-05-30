import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">
          {t("notFound.message", "Page not found")}
        </p>
        <a
          href="/"
          className="px-6 py-3 bg-gray-900 text-white rounded-md font-medium whitespace-nowrap hover:bg-gray-800 transition-colors inline-block"
        >
          {t("notFound.backHome", "Back to Home")}
        </a>
      </div>
    </div>
  );
}