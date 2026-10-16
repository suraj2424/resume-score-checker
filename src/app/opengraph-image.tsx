import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name} — free resume score checker`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DESK = "#E6E5E0";
const SHEET = "#FFFFFF";
const INK = "#1B1A17";
const INK_2 = "#5D5B54";
const INK_3 = "#8B8980";
const RULE = "#DFDDD4";
const MARK = "#FFE45C";

/** Static Open Graph card generated at build time — no external services. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: DESK,
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        {/* The sheet, lying on the desk. */}
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: SHEET,
            border: `1px solid ${RULE}`,
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 4,
                backgroundColor: INK,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
                <path d="M2 11.5h12" stroke={INK_3} strokeWidth="1" strokeLinecap="round" />
                <path
                  d="M4.5 10.5 6.75 8l2 2L11.5 6"
                  stroke="#FFFFFF"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 6h2v2"
                  stroke={MARK}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>
              {siteConfig.name}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                fontSize: 66,
                fontWeight: 700,
                color: INK,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                maxWidth: 900,
              }}
            >
              Your resume, marked up before you send it.
            </div>
            <div style={{ fontSize: 27, color: INK_2, maxWidth: 880, lineHeight: 1.45 }}>
              31 published checks across 5 weighted categories. Deterministic score, no AI, and
              your file never leaves the browser.
            </div>
          </div>

          {/* The scale, drawn to the same measure as the score itself. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", height: 10, backgroundColor: RULE }}>
              <div style={{ display: "flex", width: "78%", backgroundColor: INK }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 19,
                color: INK_3,
              }}
            >
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}