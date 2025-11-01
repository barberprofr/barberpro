import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export type PasswordInputProps = React.ComponentProps<typeof Input> & {
  revealAriaLabel?: string;
  hideAriaLabel?: string;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, revealAriaLabel = "Afficher le mot de passe", hideAriaLabel = "Masquer le mot de passe", ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          aria-label={visible ? hideAriaLabel : revealAriaLabel}
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 grid place-items-center px-2 text-muted-foreground hover:text-foreground"
          tabIndex={0}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
