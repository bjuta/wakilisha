type WakilishaAccountMarkProps = {
  size?: number;
  className?: string;
};

export function WakilishaAccountMark({
  size = 24,
  className = "",
}: WakilishaAccountMarkProps) {
  return (
    <svg
      viewBox="123 0 19 30"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        fill="#84C241"
        d="M132.91 11.14 125.04 29.87 141 11.9c.26-.29.05-.76-.34-.76h-7.75Z"
      />
      <path
        fill="#84C241"
        d="M130.72.18h6.59c.15.01.26.17.2.31-2.24 5.23-4.48 10.46-6.73 15.69l-6.74-.02c-.19 0-.32-.19-.24-.37L130.34.42c.06-.15.21-.25.37-.25Z"
      />
    </svg>
  );
}
