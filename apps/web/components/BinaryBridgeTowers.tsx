"use client";

const TOWER_HEIGHT = 7;
const TOWER_WIDTH = 4;

function Tower() {
  return (
    <div className="flex flex-col items-center">

      {/* Main tower */}
      <div className="flex flex-col items-center font-mono text-[19px] leading-none text-blue-400 [text-shadow:0_0_8px_rgba(59,130,246,0.8)]">
        {Array.from({ length: TOWER_HEIGHT }).map((_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: TOWER_WIDTH }).map((_, col) => {
              const value = (row * 7 + col * 13) % 2;

              return (
                <span key={col} className="w-[10px]">
                  {value}
                </span>
              );
            })}
          </div>
        ))}
      </div>


      {/* Bottom of tower */}
      <div className="flex flex-col items-center font-mono text-[19px] leading-none text-blue-400 [text-shadow:0_0_8px_rgba(59,130,246,0.8)]">
        <span>101100</span>
      </div>
    </div>
  );
}


function BridgeDeck() {
  return (
    <div className="bg-emerald-100 w-full">
      <div className=" min-w-[60vw]  overflow-hidden">
        <div className="flex justify-center font-mono text-[19px] leading-none tracking-[1px] text-blue-400 [text-shadow:0_0_8px_rgba(59,130,246,0.8)]">
          {Array.from({ length: 100 }).map((_, i) => (
            <span key={i}>
              {(i * 17 + 3) % 2}
            </span>
          ))}
        </div>
        <div className="flex justify-center font-mono text-[19px] leading-none tracking-[1px] text-blue-400 [text-shadow:0_0_8px_rgba(59,130,246,0.8)]">
          {Array.from({ length: 100 }).map((_, i) => (
            <span key={i}>
              {(i * 17 + 3) % 2}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


export default function BinaryBridgeTowers() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 flex items-center justify-ceter">
      <div className="flex flex-col  items-center justify-center">


        <BridgeDeck />

        <div className="towers flex gap-[30vw]">
          <Tower />
          <Tower />
        </div>
      </div>
    </div>
  );
}