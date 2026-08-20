// import type { Dispatch, SetStateAction } from "react";

// interface IntroProps {
//     deviceName: string;
//     setDeviceNameState: Dispatch<SetStateAction<string>>;
//     handleDeviceSetup: () => void;
// }


// export default function Intro(
//     {
//         deviceName,
//         setDeviceNameState,
//         handleDeviceSetup,
//     }: IntroProps
// ) {
//     return (
//         <div className="flex items-center justify-center w-1/2 h-1/2">
//             <div className="w-full h-full rounded-[20px] border border-[#1e293b] bg-[#090d16] p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">

//                 <h2 className="mb-2 text-[24px] font-bold text-[#f8fafc]">
//                     Yo!! Hermano , welcome to Escape
//                 </h2>

//                 <h3>Ever got in multi-device hell where u want to send just send a chunk of text or bits of file , but u got no straight way to do that</h3>
//                 <h3>yea yea whatsapp and apps, but who want to do all that login stuff or get into untangling wire hassles just to make your own devices talk</h3>
//                 <h3>well i always thought "agh it would be heaven if i can just drag and drop things here and there"</h3>
//                 <h3>and here we made it , just make your potatoes meet once and no one can sepertae them untill u do (sounds evil ri8)</h3>

//                 <h3>oki enough talk , lets get your device start dating</h3>


//                 <p className="mb-6 text-sm leading-[1.6] text-[#94a3b8]">
//                     Enter a name for this potato to show to other hotties
//                 </p>

//                 <input
//                     autoFocus
//                     value={deviceName}
//                     onChange={(e) => setDeviceNameState(e.target.value)}
//                     onKeyDown={(e) => {
//                         if (e.key === "Enter") {
//                             handleDeviceSetup();
//                         }
//                     }}
//                     placeholder="Device name"
//                     className="mb-3 box-border w-full rounded-[10px] border border-[#334155] bg-[#020617] px-[14px] py-3 text-sm text-[#f8fafc] outline-none placeholder:text-[#64748b] focus:border-[#2563eb]"
//                 />

//                 <p>aaww dont overthink it man , u can change it anytime blv me</p>

//                 <button
//                     onClick={handleDeviceSetup}
//                     disabled={!deviceName.trim()}
//                     className={`w-full rounded-[10px] border-none px-3 py-3 text-sm font-semibold transition-colors ${deviceName.trim()
//                         ? "cursor-pointer bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
//                         : "cursor-not-allowed bg-[#1e293b] text-[#64748b]"
//                         }`}
//                 >
//                     Continue
//                 </button>
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
        <div id="intro-panel" className="flex min-h-1/2 w-1/2 items-center justify-center   ">
            <div className="h-full w-full rounded-[20px] border border-[#1e293b] bg-[#090d16] p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">

                <h2 className="mb-4 text-[24px] font-bold text-[#f8fafc]">
                    Yo!! Hermano, welcome to BRIDGE 🤝
                </h2>

                <div className="space-y-3 text-sm leading-[1.6] text-[#94a3b8]">
                    <p>
                        Ever been stuck in that multi-device hell where you just
                        wanna send a chunk of text or a file from <b>here → there</b>?
                    </p>

                    <p>
                        Yeah, yeah... WhatsApp, cables, logins, pairing nonsense.
                        Who's got time for all that just to make your own devices
                        talk?
                    </p>

                    <p>
                        I always thought, <i>"man, wouldn't it be heaven if I could
                            just drag something here and drop it there?"</i>
                    </p>

                    <p>
                        So we made it.
                        <br />
                        Make your potatoes meet once and they'll stick together
                        until <i>you</i> decide otherwise.
                        <br />
                        <span className="text-[#64748b]">(Sounds a little evil, right?)</span>
                    </p>

                    <p className="pt-1 font-medium text-[#cbd5e1]">
                        Oki, enough talk. Let's get your device dating. 💀
                    </p>
                </div>

                <div className="mt-7">
                    <p className="mb-2 text-sm font-medium text-[#cbd5e1]">
                        What should we call this potato?
                    </p>

                    <p className="mb-3 text-xs text-[#64748b]">
                        This is how other hotties will see it.
                    </p>

                    <input
                        autoFocus
                        value={deviceName}
                        onChange={(e) => 
                            (e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleDeviceSetup();
                                handleIntroSetupDone();
                            }
                        }}
                        placeholder="Give it a name..."
                        className="mb-2 box-border w-full rounded-[10px] border border-[#334155] bg-[#020617] px-[14px] py-3 text-sm text-[#f8fafc] outline-none placeholder:text-[#64748b] focus:border-[#2563eb]"
                    />

                    <p className="mb-4 text-xs text-[#64748b]">
                        Aaaww, don't overthink it, hermano.
                        You can change it anytime. 🤝
                    </p>

                    <button
                        onClick={() => {
                            handleDeviceSetup();
                            handleIntroSetupDone();
                        }}
                        disabled={!deviceName.trim()}
                        className={`w-full rounded-[10px] px-3 py-3 text-sm font-semibold transition-colors ${deviceName.trim()
                                ? "cursor-pointer bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                                : "cursor-not-allowed bg-[#1e293b] text-[#64748b]"
                            }`}
                    >
                        Let's get this potato moving →
                    </button>
                </div>
            </div>
        </div>
    );
}
