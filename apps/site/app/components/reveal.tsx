"use client";

import { useEffect, useRef, useState } from "react";

const supportedDelays = [0, 70, 80, 90, 100, 130, 160, 180, 200];

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = element.current;
    if (!node || !("IntersectionObserver" in window)) return;

    const bounds = node.getBoundingClientRect();
    const initiallyVisible = bounds.top < window.innerHeight && bounds.bottom > 0;
    setVisible(initiallyVisible);

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(node);
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const resolvedDelay = supportedDelays.reduce((nearest, candidate) =>
    Math.abs(candidate - delay) < Math.abs(nearest - delay) ? candidate : nearest,
  );

  return <div ref={element} className={`reveal reveal-delay-${resolvedDelay} ${visible ? "is-visible" : ""} ${className}`}>{children}</div>;
}
