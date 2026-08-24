// composables/useEmailBuilderDefaults.ts
// This module contains all default component properties.
// Every component that renders a background surface carries both
// `backgroundColor` (solid fallback) and `backgroundGradient` (GradientPicker value).
import { createDefaultBaseConfig } from "./config/componentConfig";
// ─── Gradient factory helpers ─────────────────────────────────────────────────

/** Default gradient shape for a coloured component (button, divider, etc.) */
const makeBackground = (solidColor: string) => ({
  useGradient: false,
  solid: solidColor,
  gradient: {
    type: "linear" as const,
    direction: "to right",
    colors: [
      { color: solidColor, position: 0 },
      { color: "#00ff88", position: 100 },
    ],
  },
});

/** Default gradient shape for a transparent-background component (paragraph, heading, list). */
const makeTransparentBackground = () => ({
  useGradient: false,
  solid: "transparent",
  gradient: {
    type: "linear" as const,
    direction: "to right",
    colors: [
      { color: "#ffffff", position: 0 },
      { color: "#eeeeee", position: 100 },
    ],
  },
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const useEmailBuilderDefaults = () => {
  const defaultProps = {
    // ── Paragraph ────────────────────────────────────────────────────────────
    paragraph: {
      content: "Enter your paragraph text here",
      fontSize: 16,
      lineHeight: 1.5,
      color: "#111111",
      fontWeight: "normal",
      fontFamily: "Arial",
      fontStyle: "normal",
      letterSpacing: 0,
      backgroundColor: "transparent",
      backgroundGradient: makeTransparentBackground(),
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      textTransform: "none",
      textDecoration: "none",
      align: "left",
      mobile: {
        fontSize: null,
        lineHeight: null,
        color: null,
        fontWeight: null,
        fontFamily: null,
        fontStyle: null,
        letterSpacing: null,
        backgroundColor: null,
        backgroundGradient: null,
        textTransform: null,
        textDecoration: null,
        align: null,
        margin: null,
        padding: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Heading ──────────────────────────────────────────────────────────────
    heading: {
      content: "Heading Text",
      level: "h2",
      fontSize: 32,
      lineHeight: 1.2,
      color: "#111111",
      fontWeight: "bold",
      fontFamily: "Arial",
      letterSpacing: 0,
      backgroundColor: "transparent",
      backgroundGradient: makeTransparentBackground(),
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      textTransform: "none",
      textDecoration: "none",
      align: "left",
      mobile: {
        fontSize: null,
        lineHeight: null,
        color: null,
        fontWeight: null,
        fontFamily: null,
        letterSpacing: null,
        backgroundColor: null,
        backgroundGradient: null,
        textTransform: null,
        textDecoration: null,
        align: null,
        margin: null,
        padding: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Image ────────────────────────────────────────────────────────────────
    // No background surface — omitted intentionally.
    image: {
      src: `https://email-builder-nor-dev.s3.amazonaws.com/images/2026/08/20/5bffeaf2.jpeg`,
      alt: "Image",
      width: 100,
      height: "auto",
      align: "center",
      link: "https://example.com",
      enabled: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      borderRadius: 0,
      border: { width: 0, color: "transparent", style: "solid" },
      mobile: {
        width: null,
        height: null,
        align: null,
        margin: null,
        padding: null,
        borderRadius: null,
        border: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Video ────────────────────────────────────────────────────────────────
    // No background surface — omitted intentionally.
    video: {
      fallbackLink: "https://example.com",
      src: "",
      coverImage: "",
      alt: "Watch video",
      width: 100,
      height: "auto",
      align: "center",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      borderRadius: 0,
      border: { width: 0, color: "transparent", style: "solid" },
      mobile: {
        width: null,
        height: null,
        align: null,
        margin: null,
        padding: null,
        borderRadius: null,
        border: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── List ─────────────────────────────────────────────────────────────────
    list: {
      content:
        "<ul><li>List item 1</li><li>List item 2</li><li>List item 3</li></ul>",
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "Arial",
      letterSpacing: 0,
      color: "#111111",
      backgroundColor: "transparent",
      backgroundGradient: makeTransparentBackground(),
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 20 },
      itemSpacing: 8,
      mobile: {
        fontSize: null,
        lineHeight: null,
        fontFamily: null,
        letterSpacing: null,
        color: null,
        backgroundColor: null,
        backgroundGradient: null,
        margin: null,
        padding: null,
        itemSpacing: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Button ───────────────────────────────────────────────────────────────
    button: {
      text: "Click Me",
      link: "https://example.com",
      backgroundColor: "#007bff",
      backgroundGradient: makeBackground("#007bff"),
      color: "#fafafa",
      fontSize: 16,
      fontWeight: "medium",
      fontFamily: "Arial",
      letterSpacing: 0,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 12, right: 24, bottom: 12, left: 24 },
      borderRadius: 4,
      border: { width: 0, color: "transparent", style: "solid" },
      align: "center",
      // ── Icon ──────────────────────────────────────────────────────────────
      icon: "",
      iconAlt: "", // NEW — accessibility
      iconPosition: "before",
      iconSize: 20,
      iconGap: 8,
      mobile: {
        fontSize: null,
        fontWeight: null,
        fontFamily: null,
        letterSpacing: null,
        backgroundColor: null,
        backgroundGradient: null,
        color: null,
        padding: null,
        margin: null,
        borderRadius: null,
        border: null,
        align: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Anchor ───────────────────────────────────────────────────────────────
    // Inline text link — no background surface.
    anchor: {
      text: "Click here",
      link: "https://example.com",
      color: "#007bff",
      fontSize: 16,
      fontWeight: "normal",
      fontFamily: "Arial",
      letterSpacing: 0,
      textDecoration: "underline",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      align: "left",
      mobile: {
        fontSize: null,
        fontWeight: null,
        fontFamily: null,
        letterSpacing: null,
        color: null,
        textDecoration: null,
        margin: null,
        padding: null,
        align: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Divider ──────────────────────────────────────────────────────────────
    // backgroundColor IS the line colour, so gradient is meaningful here.
    divider: {
      backgroundColor: "#cccccc",
      backgroundGradient: makeBackground("#cccccc"),
      height: 1,
      width: 100,
      margin: { top: 20, right: 0, bottom: 20, left: 0 },
      padding: { top: 5, right: 0, bottom: 5, left: 0 },
      align: "center",
      mobile: {
        backgroundColor: null,
        backgroundGradient: null,
        height: null,
        width: null,
        margin: null,
        padding: null,
        align: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Spacer ───────────────────────────────────────────────────────────────
    // Pure height block — no background surface.
    spacer: {
      height: 20,
      backgroundColor: "transparent",
      backgroundGradient: makeBackground("transparent"),
      mobile: {
        height: null,
        backgroundColor: null,
        backgroundGradient: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Menu ───────────────────────────────────────────────────────────────
    menu: {
      items: [
        { label: "Home", link: "https://example.com", enabled: true },
        { label: "About", link: "https://example.com", enabled: true },
        { label: "Contact", link: "https://example.com", enabled: true },
      ],
      // Typography — mirrors paragraph
      fontSize: 16,
      lineHeight: 1.5,
      fontWeight: "normal",
      fontFamily: "Arial",
      fontStyle: "normal",
      letterSpacing: 0,
      color: "#111111",
      textTransform: "none",
      textDecoration: "none",
      // Background — mirrors paragraph
      backgroundColor: "transparent",
      backgroundGradient: makeTransparentBackground(),
      // Layout — mirrors socials
      spacing: 16, // gap between items (split half-left / half-right like socials)
      align: "center",
      // Spacing
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mobileStack: false,
      mobile: {
        fontSize: null,
        lineHeight: null,
        fontWeight: null,
        fontFamily: null,
        fontStyle: null,
        letterSpacing: null,
        color: null,
        textTransform: null,
        textDecoration: null,
        backgroundColor: null,
        backgroundGradient: null,
        spacing: null,
        align: null,
        margin: null,
        padding: null,
      },
      ...createDefaultBaseConfig(),
    },

    // ── Socials ──────────────────────────────────────────────────────────────
    // Icon row on a transparent wrapper — no background surface.
    socials: {
      platforms: [
        {
          name: "Youtube",
          link: "",
          enabled: true,
          icon: `https://email-builder-nor-dev.s3.amazonaws.com/images/2026/08/20/187d70ab.png`,
        },
        {
          name: "Linkedin",
          link: "",
          enabled: true,
          icon: `https://email-builder-nor-dev.s3.amazonaws.com/images/2026/08/20/23e45ac0.png`,
        },
        {
          name: "Instagram",
          link: "",
          enabled: true,
          icon: `https://email-builder-nor-dev.s3.amazonaws.com/images/2026/08/20/4e9832e6.png`,
        },
      ],
      iconSize: 28,
      spacing: 10,
      align: "center",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mobile: {
        iconSize: null,
        spacing: null,
        align: null,
        margin: null,
        padding: null,
      },
      ...createDefaultBaseConfig(),
    },
  };

  return { defaultProps };
};
