"use client";

type SplitBy = "words" | "chars";

type AnimatedTextProps = {
  text: string;
  splitBy?: SplitBy;
  className?: string;
  wrapper?: "span" | "div";
  /** Use "initial" for hero (animates on load), otherwise scroll-triggered */
  trigger?: "initial" | "scroll";
  /** Optional gradient class for part of text (e.g. second word) */
  gradientClassName?: string;
  gradientWordIndex?: number;
};

export default function AnimatedText({
  text,
  splitBy = "words",
  className = "",
  wrapper: Wrapper = "span",
  trigger = "scroll",
  gradientClassName,
  gradientWordIndex,
}: AnimatedTextProps) {
  const parts = splitBy === "words" ? text.split(/(\s+)/) : text.split("");
  const dataTrigger = trigger === "initial" ? "text-reveal-initial" : "text-reveal";

  return (
    <Wrapper
      className={`inline ${className}`}
      data-gsap={dataTrigger}
      aria-label={text}
    >
      {parts.map((part, i) => {
        const isSpace = splitBy === "words" && /^\s+$/.test(part);
        const contentWordIndex =
          splitBy === "words"
            ? parts.slice(0, i).filter((p) => !/^\s+$/.test(p)).length
            : Math.max(0, parts.slice(0, i + 1).join("").trim().split(/\s+/).length - 1);
        const useGradient = gradientWordIndex !== undefined && contentWordIndex === gradientWordIndex;
        if (isSpace) return <span key={`s-${i}`}>{part}</span>;
        return (
          <span
            key={i}
            className="inline-block"
            data-gsap="text-word"
          >
            <span className={`inline-block ${useGradient ? gradientClassName ?? "" : ""}`.trim()}>{part}</span>
          </span>
        );
      })}
    </Wrapper>
  );
}
