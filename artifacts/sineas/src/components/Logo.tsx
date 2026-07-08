import { Link } from "wouter";

interface LogoProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const heightClasses = {
  sm: {
    desktop: "h-9",
    mobile: "h-9",
  },
  md: {
    desktop: "h-12",
    mobile: "h-11",
  },
  lg: {
    desktop: "h-14",
    mobile: "h-12",
  },
};

export default function Logo({ className = "", href = "/", size = "md" }: LogoProps) {
  const h = heightClasses[size] || heightClasses.md;

  const content = (
    <span className={`flex items-center flex-shrink-0 ${className}`}>
      {/* Desktop Logo: Sineas logo horizontal.png */}
      <img
        src="/Sineas logo horizontal.png"
        alt="SINEAS Logo"
        className={`hidden md:block ${h.desktop} w-auto object-contain transition-transform duration-200 hover:scale-[1.02]`}
      />
      {/* Mobile Logo: SINEAS LOGO S ONLY (yellow & blue).png */}
      <img
        src="/SINEAS LOGO S ONLY (yellow & blue).png"
        alt="SINEAS Logo S"
        className={`block md:hidden ${h.mobile} w-auto object-contain transition-transform duration-200 hover:scale-105`}
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center focus:outline-none">
        {content}
      </Link>
    );
  }
  return content;
}
