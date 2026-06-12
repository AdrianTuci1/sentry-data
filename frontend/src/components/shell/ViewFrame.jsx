import { cn } from "@/lib/utils";
import "@/styles/shell.css";

export function ViewFrame({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  maxWidthClassName = "max-w-7xl",
}) {
  return (
    <section className={cn("view-frame-section", className)}>
      <div className={cn("view-frame-inner", maxWidthClassName)}>
        {(title || description || actions) && (
          <div className="view-frame-header">
            <div className="view-frame-title-group">
              {title && <h1 className="view-frame-title">{title}</h1>}
              {description && <p className="view-frame-description">{description}</p>}
            </div>
            {actions && <div className="view-frame-actions">{actions}</div>}
          </div>
        )}

        <div className={cn("view-frame-content", contentClassName)}>{children}</div>
      </div>
    </section>
  );
}
