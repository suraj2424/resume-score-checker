import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { siteConfig } from "@/config/site";
import { THEME_INIT_SCRIPT } from "@/config/theme-init";

/**
 * Archivo carries the whole page. It is loaded on both the weight and the width
 * axis so display headings can be set in the narrower cut — a slightly
 * condensed grotesque reads like a document column rather than a SaaS hero.
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
  display: "swap",
});

/**
 * Azeret Mono is used only where a number is a measurement: tick labels, point
 * totals, file facts. It is never used for prose.
 */
const azeretMono = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-azeret",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * The browser chrome has to match the desk in both modes, or a dark-mode visit
 * shows a white address bar above a dark page. `colorScheme` also opts the
 * document into the UA's own dark form controls and scrollbars, which the
 * blocking script below would otherwise have to fake.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e5e0" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0b" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The single carve-out to AGENTS.md §2.5's no-innerHTML rule. It has
            to be inline and blocking to beat the first paint (AGENTS.md §10),
            and the CSP allows it only because `next.config.ts` carries the
            sha256 of this exact string — see `@/config/theme-init`. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${archivo.variable} ${azeretMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:bg-ink focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-desk"
          >
            Skip to content
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            {/* `tabIndex={-1}` makes this a real focus target for the skip link
                without adding it to the tab order. The trailing `!` is load
                bearing: the global `:focus-visible` rule in `globals.css` is
                unlayered, so it beats any utility in `@layer utilities`, and a
                plain `focus-visible:outline-none` would be discarded — leaving
                a full-page outline around the one element that is only ever
                focused *past*. An important layered declaration outranks an
                unlayered normal one, which is the only way to opt out. */}
            <main id="main" tabIndex={-1} className="flex-1 pb-16 focus-visible:outline-none!">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
