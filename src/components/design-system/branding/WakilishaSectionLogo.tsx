import { useTheme } from "@/components/design-system/theme/ThemeProvider";

/** Canonical brand SVG chosen for the actual surface theme. */
export function WakilishaSectionLogo() {
  const { theme } = useTheme();
  return (
    <img
      data-wk-social-wordmark
      src={theme === "dark"
        ? "/assets/logos/wakilisha-logo-dark.svg"
        : "/assets/logos/wakilisha-logo-light.svg"}
      alt="WAKILISHA"
      width={133}
      height={20}
      className="block h-5 w-[133px] object-contain object-left"
    />
  );
}
