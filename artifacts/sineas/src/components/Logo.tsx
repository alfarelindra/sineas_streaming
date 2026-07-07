import { Link } from "wouter";
import { Popcorn } from "lucide-react";

interface LogoProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { icon: "w-5 h-5", box: "w-8 h-8 rounded-lg", text: "text-lg" },
  md: { icon: "w-5 h-5", box: "w-9 h-9 rounded-xl", text: "text-2xl" },
  lg: { icon: "w-7 h-7", box: "w-12 h-12 rounded-2xl", text: "text-3xl" },
};

export default function Logo({ className = "", href = "/", size = "md" }: LogoProps) {
  const s = sizes[size];
  const content = (
    <span className={`flex items-center gap-2.5 flex-shrink-0 group ${className}`}>
      <span
        className={`${s.box} grid place-items-center bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/30 ring-1 ring-yellow-400/40 transition-transform group-hover:scale-105`}
      >
        <Popcorn className={`${s.icon} text-yellow-400`} strokeWidth={2.4} />
      </span>
      <span
        className={`${s.text} font-black tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-yellow-300 bg-clip-text text-transparent`}
      >
        SINEAS
      </span>
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
