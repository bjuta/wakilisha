import * as Lucide from 'lucide-react';
import type { SVGProps } from 'react';

export type WkIconName = keyof typeof Lucide;

type WkIconProps = SVGProps<SVGSVGElement> & {
  name: WkIconName;
  size?: number;
  strokeWidth?: number;
};

export function WkIcon({ name, size = 18, strokeWidth = 2, ...props }: WkIconProps) {
  const Icon = Lucide[name] as React.ComponentType<SVGProps<SVGSVGElement>> | undefined;
  if (!Icon) return null;
  return <Icon width={size} height={size} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props} />;
}
