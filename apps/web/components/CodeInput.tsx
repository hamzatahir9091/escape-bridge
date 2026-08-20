import React, { useRef, useState, useEffect, ChangeEvent, KeyboardEvent, ClipboardEvent } from 'react';

interface CodeInputProps {
  length?: number;
  onComplete?: (code: string) => void;
}

export default function CodeInput({ length = 6, onComplete }: CodeInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);


  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle typing a single digit
  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number): void => {
    const value = e.target.value;
    if (isNaN(Number(value))) return; // Accept numbers only

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); // Get last typed character
    setOtp(newOtp);

    // Auto-focus next input field
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger completion callback if full code is entered
    if (newOtp.every((digit) => digit !== '')) {
      if (onComplete) onComplete(newOtp.join(''));
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous box if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Handle full code paste event
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().slice(0, length);

    if (/^\d+$/.test(pasteData)) {
      const pasteArray = pasteData.split('');
      const newOtp = [...otp];

      pasteArray.forEach((char, idx) => {
        newOtp[idx] = char;
      });

      setOtp(newOtp);

      // Focus the field after the pasted digits
      const nextFocus = Math.min(pasteArray.length, length - 1);
      inputRefs.current[nextFocus]?.focus();

      if (pasteArray.length === length && onComplete) {
        onComplete(pasteArray.join(''));
      }
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {otp.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-all"
        />
      ))}
    </div>
  );
}


// import React, { useRef, useState, useEffect, ChangeEvent, KeyboardEvent, ClipboardEvent, FocusEvent } from 'react';

// interface CodeInputProps {
//   length?: number;
//   onComplete?: (code: string) => void;
//   /** Ref to the element that tab should navigate to when leaving the inputs */
//   nextFocusRef?: React.RefObject<HTMLElement | null>;
// }

// export default function CodeInput({ length = 6, onComplete, nextFocusRef }: CodeInputProps) {
//   const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
//   const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

//   // Auto-focus the first input box when the component mounts
//   // useEffect(() => {
//   //   inputRefs.current[0]?.focus();
//   // }, []);

//   // Redirect focus to the first empty box if user clicks out of order
//   const handleFocus = (index: number): void => {
//     const firstEmptyIndex = otp.findIndex((val) => val === '');
    
//     // If there is an empty box before the clicked one, force focus there
//     if (firstEmptyIndex !== -1 && firstEmptyIndex < index) {
//       inputRefs.current[firstEmptyIndex]?.focus();
//     }
//   };

//   // Handle typing a single digit
//   const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number): void => {
//     const value = e.target.value;
//     if (isNaN(Number(value))) return;

//     const newOtp = [...otp];
//     newOtp[index] = value.substring(value.length - 1);
//     setOtp(newOtp);

//     // Auto-focus next input field
//     if (value && index < length - 1) {
//       inputRefs.current[index + 1]?.focus();
//     }

//     // Trigger completion callback if full code is entered
//     if (newOtp.every((digit) => digit !== '')) {
//       if (onComplete) onComplete(newOtp.join(''));
//     }
//   };

//   // Handle keyboard events (Backspace & Tab)
//   const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number): void => {
//     // 1. Intercept Tab key to exit inputs group entirely
//     if (e.key === 'Tab') {
//       e.preventDefault(); // Stop default tabbing between input boxes
      
//       if (nextFocusRef?.current) {
//         nextFocusRef.current.focus();
//       } else {
//         // Fallback: move focus to next focusable element on page
//         const focusables = Array.from(
//           document.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
//         );
//         const currentIndex = focusables.indexOf(e.currentTarget);
//         const nextElement = focusables[currentIndex + (e.shiftKey ? -1 : 1)];
//         nextElement?.focus();
//       }
//       return;
//     }

//     // 2. Handle backspace navigation
//     if (e.key === 'Backspace') {
//       if (!otp[index] && index > 0) {
//         inputRefs.current[index - 1]?.focus();
//       }
//     }
//   };

//   // Handle full code paste event
//   const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
//     e.preventDefault();
//     const pasteData = e.clipboardData.getData('text').trim().slice(0, length);

//     if (/^\d+$/.test(pasteData)) {
//       const pasteArray = pasteData.split('');
//       const newOtp = [...otp];

//       pasteArray.forEach((char, idx) => {
//         newOtp[idx] = char;
//       });

//       setOtp(newOtp);

//       const nextFocus = Math.min(pasteArray.length, length - 1);
//       inputRefs.current[nextFocus]?.focus();

//       if (pasteArray.length === length && onComplete) {
//         onComplete(pasteArray.join(''));
//       }
//     }
//   };

//   return (
//     <div className="flex gap-2 justify-center">
//       {otp.map((digit, index) => (
//         <input
//           key={index}
//           type="text"
//           inputMode="numeric"
//           maxLength={1}
//           value={digit}
//           ref={(el) => {
//             inputRefs.current[index] = el;
//           }}
//           onFocus={() => handleFocus(index)}
//           onChange={(e) => handleChange(e, index)}
//           onKeyDown={(e) => handleKeyDown(e, index)}
//           onPaste={handlePaste}
//           className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-all select-none"
//         />
//       ))}
//     </div>
//   );
// }