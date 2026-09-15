
// import type { Dispatch, SetStateAction, } from "react";

// interface IntroProps {
//     deviceName: string;
//     setDeviceNameState: Dispatch<SetStateAction<string>>;
//     handleDeviceSetup: () => void;
//     handleIntroSetupDone: () => void;
// }

// export default function Intro({
//     deviceName,
//     setDeviceNameState,
//     handleDeviceSetup,
//     handleIntroSetupDone
// }: IntroProps) {
//     return (
//         <div id="intro-panel" className="flex min-h-1/2 w-1/2 items-center justify-center   ">
//             <div className="h-full w-full rounded-[20px] border border-[#1e293b] bg-[#090d16] p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">

//                 <h2 className="mb-4 text-[24px] font-bold text-[#f8fafc]">
//                     Yo!! Hermano, welcome to BRIDGE 🤝
//                 </h2>

//                 <div className="space-y-3 text-sm leading-[1.6] text-[#94a3b8]">
//                     <p>
//                         Ever been stuck in that multi-device hell where you just
//                         wanna send a chunk of text or a file from <b>here → there</b>?
//                     </p>

//                     <p>
//                         Yeah, yeah... WhatsApp, cables, logins, pairing nonsense.
//                         Who's got time for all that just to make your own devices
//                         talk?
//                     </p>

//                     <p>
//                         I always thought, <i>"man, wouldn't it be heaven if I could
//                             just drag something here and drop it there?"</i>
//                     </p>

//                     <p>
//                         So we made it.
//                         <br />
//                         Make your potatoes meet once and they'll stick together
//                         until <i>you</i> decide otherwise.
//                         <br />
//                         <span className="text-[#64748b]">(Sounds a little evil, right?)</span>
//                     </p>

//                     <p className="pt-1 font-medium text-[#cbd5e1]">
//                         Oki, enough talk. Let's get your device dating. 💀
//                     </p>
//                 </div>

//                 <div className="mt-7">
//                     <p className="mb-2 text-sm font-medium text-[#cbd5e1]">
//                         What should we call this potato?
//                     </p>

//                     <p className="mb-3 text-xs text-[#64748b]">
//                         This is how other hotties will see it.
//                     </p>

//                     <input
//                         value={deviceName}
//                         autoFocus
//                         onChange={(e) => 
//                             (setDeviceNameState(e.target.value))}
//                         onKeyDown={(e) => {
//                             if (e.key === "Enter") {
//                                 handleDeviceSetup();
//                                 handleIntroSetupDone();
//                             }
//                         }}
//                         placeholder="Give it a name..."
//                         className="mb-2 box-border w-full rounded-[10px] border border-[#334155] bg-[#020617] px-3.5 py-3 text-sm text-[#f8fafc] outline-none placeholder:text-[#64748b] focus:border-[#2563eb]"
//                     />

//                     <p className="mb-4 text-xs text-[#64748b]">
//                         Aaaww, don't overthink it, hermano.
//                         You can change it anytime. 🤝
//                     </p>

//                     <button
//                         onClick={() => {
//                             handleDeviceSetup();
//                             handleIntroSetupDone();
//                         }}
//                         disabled={!deviceName.trim()}
//                         className={`w-full rounded-[10px] px-3 py-3 text-sm font-semibold transition-colors ${deviceName.trim()
//                                 ? "cursor-pointer bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
//                                 : "cursor-not-allowed bg-[#1e293b] text-[#64748b]"
//                             }`}
//                     >
//                         Let's get this potato moving →
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// }



import type { Dispatch, SetStateAction, } from "react";

interface IntroProps {
    deviceName: string;
    setDeviceNameState: Dispatch<SetStateAction<string>>;
    handleDeviceSetup: () => void;
    handleIntroSetupDone: () => void;
}

export default function Intro({
    deviceName,
    setDeviceNameState,
    handleDeviceSetup,
    handleIntroSetupDone
}: IntroProps) {
    return (
        <div id="intro-panel" className="flex min-h-1/2 w-full max-w-[34rem] md:w-1/2 md:max-w-[38rem] items-center justify-center font-['Inter_Tight','Inter',system-ui,-apple-system,sans-serif]">
            <div className="relative h-full w-full max-h-[86svh] overflow-y-auto overflow-x-hidden rounded-[18px] border border-[#E8E3D5]/12 bg-[#1C1B14] p-5 sm:p-7 lg:p-8 shadow-[inset_0_1px_0_rgba(232,227,213,0.06),0_30px_60px_-40px_rgba(0,0,0,1)] eb-scroll">

                {/* top hairline — same accent seam as the room cards */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C2552F]/50 to-transparent" />

                <h2 className="mb-4 flex items-center gap-2.5 text-[20px] sm:text-[24px] font-bold tracking-[-0.02em] text-[#EDE8DA]">
                    <span className="inline-block h-[18px] w-[3px] shrink-0 rounded-full bg-[#C2552F]" />
                    Yo!! Hermano, welcome to BRIDGE 🤝
                </h2>

                <div className="space-y-3 text-[13px] sm:text-sm leading-[1.65] text-[#8A8576]">
                    <p>
                        Ever been stuck in that multi-device hell where you just
                        wanna send a chunk of text or a file from <b className="font-semibold text-[#C6C0AE]">here → there</b>?
                    </p>

                    <p>
                        Yeah, yeah... WhatsApp, cables, logins, pairing nonsense.
                        Who's got time for all that just to make your own devices
                        talk?
                    </p>

                    <p>
                        I always thought, <i className="text-[#B5AF9D]">"man, wouldn't it be heaven if I could
                            just drag something here and drop it there?"</i>
                    </p>

                    <p>
                        So we made it.
                        <br />
                        Make your potatoes meet once and they'll stick together
                        until <i className="text-[#B5AF9D]">you</i> decide otherwise.
                        <br />
                        <span className="text-[#6E6A5D]">(Sounds a little evil, right?)</span>
                    </p>

                    <p className="pt-1 font-medium text-[#C6C0AE]">
                        Oki, enough talk. Let's get your device dating. 💀
                    </p>
                </div>

                <div className="mt-6 sm:mt-7 border-t border-[#E8E3D5]/8 pt-5 sm:pt-6">
                    <p className="mb-2 text-[13px] sm:text-sm font-semibold text-[#EDE8DA]">
                        What should we call this potato?
                    </p>

                    <p className="mb-3 text-xs text-[#6E6A5D]">
                        This is how other hotties will see it.
                    </p>

                    <input
                        value={deviceName}
                        autoFocus
                        onChange={(e) => 
                            (setDeviceNameState(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleDeviceSetup();
                                handleIntroSetupDone();
                            }
                        }}
                        placeholder="Give it a name..."
                        className="mb-2 box-border w-full min-w-0 rounded-[9px] bg-[#121109] px-3.5 py-3 text-sm text-[#EDE8DA] outline-none ring-1 ring-inset ring-[#E8E3D5]/12 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] transition placeholder:text-[#6E6A5D] focus:ring-[#C2552F]/50"
                    />

                    <p className="mb-4 text-xs leading-relaxed text-[#6E6A5D]">
                        Aaaww, don't overthink it, hermano.
                        You can change it anytime. 🤝
                    </p>

                    <button
                        onClick={() => {
                            handleDeviceSetup();
                            handleIntroSetupDone();
                        }}
                        disabled={!deviceName.trim()}
                        className={`eb-tactile eb-focus w-full min-h-[46px] rounded-[9px] px-3 py-3 text-sm font-semibold transition ${deviceName.trim()
                                ? "cursor-pointer bg-[#C2552F] text-[#1A0E08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.28),0_10px_24px_-16px_rgba(194,85,47,0.9)] hover:bg-[#CE5F37] active:translate-y-px"
                                : "cursor-not-allowed border border-[#E8E3D5]/8 bg-[#1A1912] text-[#5A574C]"
                            }`}
                    >
                        Let's get this potato moving →
                    </button>
                </div>
            </div>
        </div>
    );
}