import { useNavigate } from "react-router-dom";
import { type LucideIcon } from "lucide-react";

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  path: string;
}

export function NavButton({ icon: Icon, label, path }: NavButtonProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-bg-subtle"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}