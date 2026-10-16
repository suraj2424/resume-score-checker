import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Ink is the only colour that means "act". Buttons are square-ish, flat, and
 * carry no iconography by default — the label says what happens.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-[14px] font-semibold tracking-[-0.008em] transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-xs hover:bg-ink-soft active:bg-ink",
        secondary:
          "border border-rule-2 bg-sheet text-ink hover:bg-sheet-tint active:bg-sheet-tint",
        quiet:
          "border border-transparent bg-transparent text-ink-2 hover:bg-sheet-tint hover:text-ink",
        underline:
          "h-auto rounded-none p-0 text-ink underline decoration-rule-2 decoration-1 underline-offset-4 hover:decoration-ink",
        danger:
          "border border-issue/30 bg-issue/10 text-issue hover:bg-issue hover:text-white",
      },
      size: {
        xs: "h-7 px-2 text-[12px] [&_svg]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        default: "h-10 px-4 [&_svg]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };