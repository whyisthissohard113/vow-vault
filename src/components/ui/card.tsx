import type { HTMLAttributes, ReactNode } from "react";

function cardClass(className?: string): string {
  return `card-soft bg-white ${className ?? ""}`;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cardClass(className)} {...rest} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-6 py-5">
      <div>
        <h3 className="text-base font-semibold text-stone-900">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-stone-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}

export function CardContent({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 py-5 ${className ?? ""}`} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-t border-stone-100 px-6 py-4 ${className ?? ""}`}
      {...rest}
    />
  );
}