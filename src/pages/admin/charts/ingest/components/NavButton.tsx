import { useNavigate } from "react-router-dom";

interface NavButtonProps {
  icon: string;
  label: string;
  path: string;
}

export function NavButton({ icon, label, path }: NavButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
    >
      <i className={icon} />
      {label}
    </button>
  );
}