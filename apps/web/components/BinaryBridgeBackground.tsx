
"use client";

const columns = 45;
const rows = 46;

export default function BinaryBackground() {
  return (
    <div className="fixed inset-0 z-[-1] flex justify-between overflow-hidden bg-[#020813] px-[1.5vw]">
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <div
          key={columnIndex}
          className={`flex flex-col whitespace-nowrap select-none font-mono text-[14px] leading-[1.7] ${
            columnIndex % 2 === 0
              ? "text-[rgba(110,130,155,0.20)]"
              : "text-[rgba(80,100,125,0.13)]"
          }`}
        >
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <span key={rowIndex}>
              {(columnIndex + rowIndex) % 2}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
