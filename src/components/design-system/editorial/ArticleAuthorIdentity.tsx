import type {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

type ArticleAuthorIdentityProps = {
  name: string;
  personPath?: string | null;
  className?: string;
  plainClassName?: string;
  children?: ReactNode;
  nested?: boolean;
  onClick?: (
    event: MouseEvent<HTMLElement>,
  ) => void;
};

function plainClasses(
  className?: string,
): string | undefined {
  if (!className) return undefined;

  const classes = className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => (
      token !== "cursor-pointer"
      && !token.startsWith("hover:")
      && !token.startsWith("focus:")
      && !token.startsWith("focus-visible:")
      && !token.startsWith("active:")
    ));

  return classes.join(" ") || undefined;
}

export function ArticleAuthorIdentity({
  name,
  personPath,
  className,
  plainClassName,
  children,
  nested = false,
  onClick,
}: ArticleAuthorIdentityProps) {
  const navigate = useNavigate();
  const content = children ?? name;

  if (!personPath) {
    return (
      <span
        className={
          plainClassName
          ?? plainClasses(className)
        }
      >
        {content}
      </span>
    );
  }

  if (!nested && !onClick) {
    return (
      <Link
        to={personPath}
        className={className}
      >
        {content}
      </Link>
    );
  }

  const handleClick = (
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.(event);
    navigate(personPath);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLElement>,
  ) => {
    if (
      event.key !== "Enter"
      && event.key !== " "
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    navigate(personPath);
  };

  return (
    <span
      role="link"
      tabIndex={0}
      className={[
        className,
        "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {content}
    </span>
  );
}
