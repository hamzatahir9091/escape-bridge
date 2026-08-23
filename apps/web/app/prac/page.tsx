"use client";

import { useRef } from "react";
import gsap from "gsap";

export default function Prac() {
  const textareaRef = useRef(null);

  const increaseHeight = () => {
    gsap.to(textareaRef.current, {
      height: "200px",
      duration: 0.5,
      ease: "power2.out",
    });
  };

  return (
    <div>
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder="hello im dumb"
        className="box-border w-[3vw] resize-none overflow-auto scrollbar-none rounded-lg border border-slate-800 bg-green-900 px-3 py-2 text-xs text-slate-50 outline-none"
      />

      <button
        onClick={increaseHeight}
        className="mt-3 rounded-lg bg-blue-500 px-4 py-2 text-white"
      >
        Increase Height
      </button>
    </div>
  );
}