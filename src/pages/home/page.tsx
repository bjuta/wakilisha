import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-4">
          {t("home.title", "WAKILISHA")}
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          {t("home.subtitle", "Data Repair & Relationship Graph")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="px-6 py-3 bg-gray-900 text-white rounded-md font-medium whitespace-nowrap hover:bg-gray-800 transition-colors cursor-pointer">
            {t("home.cta", "Get Started")}
          </button>
        </div>
      </div>
    </div>
  );
}