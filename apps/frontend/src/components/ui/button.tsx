import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-[#00647c] to-[#007f9d] text-white shadow-[0_8px_32px_rgba(0,100,124,0.2)] border border-white/30 hover:shadow-[0_8px_32px_rgba(0,100,124,0.4)] hover:brightness-110",
        destructive:
          "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md border border-white/30 hover:brightness-110",
        outline:
          "border border-white/40 bg-white/20 hover:bg-white/40 text-foreground backdrop-blur-md shadow-sm dark:bg-black/20 dark:border-white/10 dark:hover:bg-white/10",
        secondary:
          "bg-white/40 text-foreground hover:bg-white/60 backdrop-blur-md border border-white/20 shadow-sm dark:bg-black/40",
        ghost: "hover:bg-white/20 hover:text-foreground backdrop-blur-sm dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-white/30 backdrop-blur-md border border-white/40 text-foreground hover:bg-white/40 shadow-[0_8px_32px_rgba(25,28,30,0.06)] dark:bg-black/30 dark:border-white/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
