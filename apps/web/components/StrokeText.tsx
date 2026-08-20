"use client";

import {
    CSSProperties,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export type StrokeTextTrigger = "mount" | "hover" | "scroll" | "loop";
export type StrokeTextFillMode = "wipe" | "fade" | "none";

export interface StrokeTextProps {
    text?: string;
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    drawDuration?: number;
    fillDelay?: number;
    stagger?: number;
    ease?: string;
    trigger?: StrokeTextTrigger;
    fillMode?: StrokeTextFillMode;
    fontSize?: number;
    fontWeight?: number | string;
    letterSpacing?: number;
    reverse?: boolean;
    className?: string;
    style?: CSSProperties;

    onComplete?: () => void;

}

interface StrokeTextBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

const DEFAULT_TEXT = "Draw Attention";

const StrokeText = ({
    text = DEFAULT_TEXT,
    strokeColor = "#A78BFA",
    fillColor = "#F8FAFC",
    strokeWidth = 1.4,
    drawDuration = 1.6,
    fillDelay = 0.2,
    stagger = 0.05,
    ease = "power2.out",
    trigger = "mount",
    fillMode = "wipe",
    fontSize = 128,
    fontWeight = 800,
    letterSpacing = -4,
    reverse = false,
    className = "",
    style = {},
    onComplete
}: StrokeTextProps) => {
    const rootRef = useRef<HTMLSpanElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const strokeTextRef = useRef<SVGTextElement | null>(null);
    const wipeRectRef = useRef<SVGRectElement | null>(null);

    const [box, setBox] = useState<StrokeTextBox | null>(null);

    const rawId = useId();

    const wipeId = `stroke-text-wipe-${rawId.replace(
        /[^a-zA-Z0-9_-]/g,
        ""
    )}`;

    const characters = useMemo(
        () => Array.from(String(text ?? "")),
        [text]
    );

    const dash = Math.max(fontSize * 7, 200);

    const fontStyle = useMemo<CSSProperties>(
        () => ({
            fontSize: `${fontSize}px`,
            fontWeight,
            letterSpacing: `${letterSpacing}px`,
        }),
        [fontSize, fontWeight, letterSpacing]
    );

    /*
     * ============================================================
     * MEASURE TEXT
     * ============================================================
     */

    useLayoutEffect(() => {
        const node = strokeTextRef.current;

        if (!node) return;

        let cancelled = false;

        const measure = () => {
            if (cancelled || !strokeTextRef.current) return;

            let bbox: DOMRect;

            try {
                bbox = strokeTextRef.current.getBBox();
            } catch {
                return;
            }

            if (!bbox || !bbox.width || !bbox.height) return;

            const pad = Math.max(
                Number(strokeWidth) || 1,
                fontSize * 0.1
            );

            const next: StrokeTextBox = {
                x: bbox.x - pad,
                y: bbox.y - pad,
                width: bbox.width + pad * 2,
                height: bbox.height + pad * 2,
            };

            setBox((prev) => {
                if (
                    prev &&
                    Math.abs(prev.x - next.x) < 0.5 &&
                    Math.abs(prev.y - next.y) < 0.5 &&
                    Math.abs(prev.width - next.width) < 0.5 &&
                    Math.abs(prev.height - next.height) < 0.5
                ) {
                    return prev;
                }

                return next;
            });
        };

        measure();

        if (typeof document !== "undefined" && document.fonts?.ready) {
            document.fonts.ready.then(measure).catch(() => { });
        }

        return () => {
            cancelled = true;
        };
    }, [
        characters,
        fontSize,
        fontWeight,
        letterSpacing,
        strokeWidth,
    ]);

    /*
     * ============================================================
     * GSAP
     * ============================================================
     */

    useGSAP(
        () => {
            const root = rootRef.current;
            const svg = svgRef.current;

            if (!root || !svg || !box) return;

            const strokes = gsap.utils.toArray<SVGTextElement>(
                root.querySelectorAll("[data-stroke-char]")
            );

            const fills = gsap.utils.toArray<SVGTextElement>(
                root.querySelectorAll("[data-fill-char]")
            );

            const wipe = wipeRectRef.current;

            if (!strokes.length) return;

            const fillEnabled = fillMode !== "none";
            const useWipe = fillEnabled && fillMode === "wipe";

            const fillDuration = Math.max(
                0.4,
                drawDuration * 0.5
            );

            const staggerConfig: number | gsap.StaggerVars = reverse
                ? {
                    each: stagger,
                    from: "end",
                }
                : stagger;

            const targets = [
                ...strokes,
                ...fills,
                ...(wipe ? [wipe] : []),
            ];

            /*
             * --------------------------------------------------------
             * START STATE
             * --------------------------------------------------------
             */

            const setStart = () => {
                gsap.set(strokes, {
                    strokeDasharray: dash,
                    strokeDashoffset: dash,
                });

                gsap.set(fills, {
                    opacity: useWipe ? 1 : 0,
                });

                if (wipe) {
                    gsap.set(wipe, {
                        attr: {
                            width: 0,
                        },
                    });
                }
            };

            /*
             * --------------------------------------------------------
             * END STATE
             * --------------------------------------------------------
             */

            const setEnd = () => {
                gsap.set(strokes, {
                    strokeDasharray: dash,
                    strokeDashoffset: 0,
                });

                gsap.set(fills, {
                    opacity: fillEnabled ? 1 : 0,
                });

                if (wipe) {
                    gsap.set(wipe, {
                        attr: {
                            width: fillEnabled ? box.width : 0,
                        },
                    });
                }
            };

            /*
             * --------------------------------------------------------
             * REDUCED MOTION
             * --------------------------------------------------------
             */

            const prefersReducedMotion =
                window.matchMedia?.(
                    "(prefers-reduced-motion: reduce)"
                ).matches;

            if (prefersReducedMotion) {
                setEnd();

                // Reveal immediately.
                gsap.set(svg, {
                    opacity: 1,
                });

                return () => {
                    gsap.killTweensOf(targets);
                };
            }

            /*
             * --------------------------------------------------------
             * HOVER
             * --------------------------------------------------------
             */

            if (trigger === "hover") {
                // Hover starts already visible.
                setEnd();

                gsap.set(svg, {
                    opacity: 1,
                });

                const play = () => {
                    const timeline = buildTimeline();
                    timeline.play(0);
                };

                function buildTimeline() {
                    const tl = gsap.timeline({
                        paused: true,
                        defaults: {
                            overwrite: "auto",
                        },
                    });

                    tl.to(
                        strokes,
                        {
                            strokeDashoffset: 0,
                            duration: drawDuration,
                            ease,
                            stagger: staggerConfig,
                        },
                        0
                    );

                    if (useWipe && wipe) {
                        tl.to(
                            wipe,
                            {
                                attr: {
                                    width: box!.width,
                                },
                                duration: fillDuration,
                                ease: "power2.inOut",
                            },
                            drawDuration + fillDelay
                        );
                    } else if (fillEnabled) {
                        tl.to(
                            fills,
                            {
                                opacity: 1,
                                duration: fillDuration,
                                ease: "power2.out",
                                stagger: staggerConfig,
                            },
                            drawDuration + fillDelay
                        );
                    }

                    return tl;
                }

                root.addEventListener("pointerenter", play);

                return () => {
                    root.removeEventListener("pointerenter", play);
                    gsap.killTweensOf(targets);
                };
            }

            /*
             * --------------------------------------------------------
             * MOUNT / SCROLL / LOOP
             * --------------------------------------------------------
             */

            // IMPORTANT:
            // Prepare everything while SVG is still opacity: 0.
            setStart();

            /*
             * Now the stroke is hidden and the fill/wipe is ready.
             *
             * Only NOW do we reveal the SVG.
             */
            gsap.set(svg, {
                opacity: 1,
            });

            /*
             * --------------------------------------------------------
             * BUILD TIMELINE
             * --------------------------------------------------------
             */

            const timeline = gsap.timeline({
                paused: true,
                repeat: trigger === "loop" ? -1 : 0,
                repeatDelay: trigger === "loop" ? 0.9 : 0,
                defaults: {
                    overwrite: "auto",
                },
                onComplete: () => {
                    onComplete?.();
                },
            });

            /*
             * Draw stroke
             */

            timeline.to(
                strokes,
                {
                    strokeDashoffset: 0,
                    duration: drawDuration,
                    ease,
                    stagger: staggerConfig,
                },
                0
            );

            /*
             * Fill
             */

            if (useWipe && wipe) {
                timeline.to(
                    wipe,
                    {
                        attr: {
                            width: box.width,
                        },
                        duration: fillDuration,
                        ease: "power2.inOut",
                    },
                    drawDuration + fillDelay
                );
            } else if (fillEnabled) {
                timeline.to(
                    fills,
                    {
                        opacity: 1,
                        duration: fillDuration,
                        ease: "power2.out",
                        stagger: staggerConfig,
                    },
                    drawDuration + fillDelay
                );
            }

            /*
             * --------------------------------------------------------
             * SCROLL
             * --------------------------------------------------------
             */

            let scrollTrigger: ScrollTrigger | undefined;

            if (trigger === "scroll") {
                scrollTrigger = ScrollTrigger.create({
                    trigger: root,
                    start: "top 82%",
                    once: true,
                    onEnter: () => {
                        timeline.play(0);
                    },
                });
            } else {
                /*
                 * Mount / Loop
                 */

                timeline.play(0);
            }

            /*
             * --------------------------------------------------------
             * CLEANUP
             * --------------------------------------------------------
             */

            return () => {
                scrollTrigger?.kill();
                timeline.kill();
                gsap.killTweensOf(targets);
            };
        },
        {
            scope: rootRef,
            dependencies: [
                box,
                dash,
                drawDuration,
                fillDelay,
                stagger,
                ease,
                trigger,
                fillMode,
                reverse,
            ],
        }
    );

    /*
     * ============================================================
     * SVG
     * ============================================================
     */

    const viewBox = box
        ? `${box.x} ${box.y} ${box.width} ${box.height}`
        : `0 ${-fontSize} 600 ${fontSize * 1.3}`;

    return (
        <span
            ref={rootRef}
            className={`block w-full leading-[0] ${trigger === "hover" ? "cursor-pointer" : ""
                } ${className}`.trim()}
            style={style}
            role="img"
            aria-label={String(text ?? "")}
        >
            <svg
                ref={svgRef}
                className="block w-full"
                style={{
                    /*
                     * ====================================================
                     * THIS IS THE FLASH FIX
                     * ====================================================
                     *
                     * The SVG is invisible from its very first render.
                     *
                     * GSAP changes this to opacity: 1 only AFTER
                     * strokeDashoffset has been initialized.
                     */
                    opacity: 0,
                    height: `${Math.round(fontSize * 1.3)}px`,
                }}
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
            >
                {fillMode === "wipe" && box && (
                    <defs>
                        <clipPath
                            id={wipeId}
                            clipPathUnits="userSpaceOnUse"
                        >
                            <rect
                                ref={wipeRectRef}
                                x={box.x}
                                y={box.y}
                                width="0"
                                height={box.height}
                            />
                        </clipPath>
                    </defs>
                )}

                {/* =====================================================
            STROKE TEXT
        ===================================================== */}

                <text
                    ref={strokeTextRef}
                    className="select-none"
                    x="0"
                    y="0"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={fontStyle}
                >
                    {characters.map((char, index) => (
                        <tspan
                            data-stroke-char
                            key={`s-${index}`}
                        >
                            {char}
                        </tspan>
                    ))}
                </text>

                {/* =====================================================
            FILL TEXT
        ===================================================== */}

                <text
                    className="select-none"
                    x="0"
                    y="0"
                    fill={fillColor}
                    stroke="none"
                    style={{
                        ...fontStyle,
                        opacity: fillMode === "none" ? 0 : 1,
                    }}
                    clipPath={
                        fillMode === "wipe" && box
                            ? `url(#${wipeId})`
                            : undefined
                    }
                >
                    {characters.map((char, index) => (
                        <tspan
                            data-fill-char
                            key={`f-${index}`}
                        >
                            {char}
                        </tspan>
                    ))}
                </text>
            </svg>
        </span>
    );
};

export default StrokeText;