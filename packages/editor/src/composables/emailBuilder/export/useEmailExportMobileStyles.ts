export const useEmailExportMobileStyles = () => {
  const emailMobileStyles = (comp: any, uid: string): string => {
    // ── CRITICAL: resolve render variant — new shape uses componentType,
    // legacy shape uses type directly.
    const compType = comp.componentType ?? comp.type;
    const mobileStack = comp.props.mobileStack === true;

    // A stacked menu must still emit its stacking CSS even when no other
    // `props.mobile` overrides exist — stacking is driven by props.mobileStack,
    // not by props.mobile. Without this guard, toggling "stack on mobile" on a
    // menu that has no other mobile overrides would emit nothing and the items
    // would never stack in the email.
    const rawMobile = comp.props.mobile;
    if (!rawMobile && !(compType === "menu" && mobileStack)) return "";
    const m = rawMobile ?? {};

    const containerRules: string[] = [];
    const elementRules: string[] = [];
    const childRules: string[] = [];

    const anchorTypes = new Set(["button", "anchor"]);
    const isAnchorType = anchorTypes.has(compType);

    const tdTypes = new Set(["menu", "socials"]);
    const isTdType = tdTypes.has(compType);

    const addRule = (arr: string[], rule?: any) => {
      if (rule) arr.push(rule);
    };

    /* ================================
       BACKGROUND RESOLVER

       The mobile object stores backgroundGradient as:
         - null  → no override, inherit desktop (do nothing)
         - BackgroundValue object → the user set a mobile-specific background

       Inside a non-null BackgroundValue:
         useGradient: true  → emit a CSS gradient
         useGradient: false → emit the solid colour from .solid

       We intentionally ignore `m.backgroundColor` as a standalone signal
       when `m.backgroundGradient` is present, because setBackground() in
       useEmailComponentProps always writes both in sync. The gradient object
       is the single source of truth for mobile background overrides.
    ================================= */

    // Returns [] (no override), [solid] (solid mode), or [solid, gradient]
    // (gradient mode — Outlook reads solid, Gmail reads gradient).
    const resolveMobileBackground = (): string[] => {
      const bg = m.backgroundGradient;

      if (bg != null) {
        if (
          bg.useGradient === true &&
          Array.isArray(bg.gradient?.colors) &&
          bg.gradient.colors.length >= 2
        ) {
          const { type, direction, colors } = bg.gradient;
          const stops = colors
            .map((c: any) => `${c.color} ${c.position}%`)
            .join(", ");
          const gradientCss =
            type === "radial"
              ? `radial-gradient(circle at center, ${stops})`
              : `linear-gradient(${direction}, ${stops})`;

          const solid = bg.solid || m.backgroundColor || "";
          const result: string[] = [];
          result.push(
            `background-color: ${solid && solid !== "transparent" ? solid : "transparent"} !important`,
          );
          result.push(`background: ${gradientCss} !important`);
          return result;
        }

        const solidColor = bg.solid ?? m.backgroundColor;
        if (solidColor != null) {
          return [
            `background: none !important`,
            `background-color: ${solidColor} !important`,
          ];
        }
        return [];
      }

      // Fallback: no gradient object, but standalone mobile backgroundColor
      if (m.backgroundColor != null) {
        return [
          `background: none !important`,
          `background-color: ${m.backgroundColor} !important`,
        ];
      }

      return [];
    };

    /* ================================
       SHARED TEXT / ELEMENT STYLES
       Called for: paragraph, heading, list, button, anchor
    ================================= */

    const pushTextStyles = (target: string[]) => {
      addRule(
        target,
        m.fontSize != null && `font-size: ${m.fontSize}px !important`,
      );
      addRule(
        target,
        m.lineHeight != null && `line-height: ${m.lineHeight} !important`,
      );
      addRule(
        target,
        m.letterSpacing != null &&
          `letter-spacing: ${m.letterSpacing}px !important`,
      );
      addRule(target, m.color != null && `color: ${m.color} !important`);
      addRule(
        target,
        m.fontWeight != null && `font-weight: ${m.fontWeight} !important`,
      );
      addRule(
        target,
        m.fontFamily != null &&
          `font-family: '${m.fontFamily}', Arial, sans-serif !important`,
      );
      addRule(
        target,
        m.fontStyle != null && `font-style: ${m.fontStyle} !important`,
      );
      addRule(
        target,
        m.textTransform != null &&
          `text-transform: ${m.textTransform} !important`,
      );
      addRule(
        target,
        m.textDecoration != null &&
          `text-decoration: ${m.textDecoration} !important`,
      );

      // Gradient-aware background — pushes 0, 1, or 2 declarations
      target.push(...resolveMobileBackground());
    };

    /* ================================
       SPACING → CONTAINER
    ================================= */

    if (m.margin) {
      const mg = m.margin;
      containerRules.push(
        `margin: ${mg.top}px ${mg.right}px ${mg.bottom}px ${mg.left}px !important`,
      );
    }

    // Padding lives on the container for everything except button/anchor | menu/social
    // (those apply it directly on the <a> tag further below)
    if (m.padding && !isAnchorType && !isTdType) {
      const pd = m.padding;
      containerRules.push(
        `padding: ${pd.top}px ${pd.right}px ${pd.bottom}px ${pd.left}px !important`,
      );
    }

    if (m.align != null && !isTdType) {
      containerRules.push(`text-align: ${m.align} !important`);
    }

    /* ================================
       TYPE-SPECIFIC LOGIC
    ================================= */

    // ── Button / Anchor — visual styles target the <a> tag ──────────────────
    if (anchorTypes.has(compType)) {
      pushTextStyles(elementRules);

      // Button padding belongs on the <a> (it defines the clickable hit area)
      if (m.padding && compType === "button") {
        const pd = m.padding;
        elementRules.push(
          `padding: ${pd.top}px ${pd.right}px ${pd.bottom}px ${pd.left}px !important`,
        );
      }

      if (m.border) {
        const br = m.border;
        elementRules.push(
          `border: ${br.width}px ${br.style} ${br.color} !important`,
        );
      }
      if (m.borderRadius != null) {
        elementRules.push(`border-radius: ${m.borderRadius}px !important`);
      }

      // ── Icon-button text cell ────────────────────────────────────────────
      // When a button has an icon, the visible text lives inside a <td> with
      // its own explicit text styles (color, font-size, etc.) that beat any
      // inherited value from the <a>. We emit a parallel rule targeting the
      // text <td> so mobile text overrides land correctly.
      //
      // For plain buttons (no icon) the <td class="-text"> simply doesn't
      // exist in the DOM, so this rule is a harmless no-op.
      //
      // We only emit TEXT-APPEARANCE properties here — no padding/border/
      // background, since those still belong on the <a>.
      if (compType === "button") {
        const textCellRules: string[] = [];
        addRule(
          textCellRules,
          m.fontSize != null && `font-size: ${m.fontSize}px !important`,
        );
        addRule(
          textCellRules,
          m.letterSpacing != null &&
            `letter-spacing: ${m.letterSpacing}px !important`,
        );
        addRule(
          textCellRules,
          m.color != null && `color: ${m.color} !important`,
        );
        addRule(
          textCellRules,
          m.fontWeight != null && `font-weight: ${m.fontWeight} !important`,
        );
        addRule(
          textCellRules,
          m.fontFamily != null &&
            `font-family: '${m.fontFamily}', Arial, sans-serif !important`,
        );
        addRule(
          textCellRules,
          m.fontStyle != null && `font-style: ${m.fontStyle} !important`,
        );
        addRule(
          textCellRules,
          m.textTransform != null &&
            `text-transform: ${m.textTransform} !important`,
        );
        addRule(
          textCellRules,
          m.textDecoration != null &&
            `text-decoration: ${m.textDecoration} !important`,
        );

        if (textCellRules.length > 0) {
          childRules.push(`.${uid}-text { ${textCellRules.join("; ")} }`);
        }
      }
    }

    // ── Image ────────────────────────────────────────────────────────────────
    else if (compType === "image") {
      addRule(elementRules, m.width != null && `width: ${m.width}% !important`);
      addRule(
        elementRules,
        m.height != null && `height: ${m.height} !important`,
      );
      addRule(
        elementRules,
        m.borderRadius != null &&
          `border-radius: ${m.borderRadius}px !important`,
      );
      addRule(
        elementRules,
        m.border != null &&
          `border: ${m.border.width}px ${m.border.style} ${m.border.color} !important`,
      );
    }

    // ── Video ────────────────────────────────────────────────────────────────
    else if (compType === "video") {
      addRule(elementRules, m.width != null && `width: ${m.width}% !important`);
      addRule(
        elementRules,
        m.height != null && `height: ${m.height} !important`,
      );
      addRule(
        elementRules,
        m.borderRadius != null &&
          `border-radius: ${m.borderRadius}px !important`,
      );
      addRule(
        elementRules,
        m.border != null &&
          `border: ${m.border.width}px ${m.border.style} ${m.border.color} !important`,
      );
    }

    // ── Divider ──────────────────────────────────────────────────────────────
    // The <td> IS the coloured surface, so background rules go on tdRules.
    else if (compType === "divider") {
      const tableRules: string[] = [];
      const tdRules: string[] = [];

      // Width on the inner divider table
      if (m.width != null) tableRules.push(`width: ${m.width}% !important`);

      // Alignment via margin on the inner divider table
      // (same mechanism as desktop — margin:auto has room because width is not 100%)
      if (m.align != null) {
        const ml = m.align === "left" ? "0" : "auto";
        const mr = m.align === "right" ? "0" : "auto";
        tableRules.push(`margin-left: ${ml} !important`);
        tableRules.push(`margin-right: ${mr} !important`);
      }

      // Height on the inner divider <td>
      if (m.height != null) {
        tdRules.push(`height: ${m.height}px !important`);
        tdRules.push(`line-height: ${m.height}px !important`);
      }

      // Background on the inner divider <td> — that's the coloured surface
      tdRules.push(...resolveMobileBackground());

      if (tableRules.length > 0)
        childRules.push(`.${uid}-divider-table { ${tableRules.join("; ")} }`);

      if (tdRules.length > 0)
        childRules.push(`.${uid}-divider-td { ${tdRules.join("; ")} }`);
    }

    // ── Spacer ───────────────────────────────────────────────────────────────
    else if (compType === "spacer") {
      const tdRules: string[] = [];

      if (m.height != null) {
        tdRules.push(`height: ${m.height}px !important`);
        tdRules.push(`line-height: ${m.height}px !important`);
      }

      // Gradient-aware background on the spacer cell — 0, 1, or 2 declarations
      tdRules.push(...resolveMobileBackground());

      if (tdRules.length > 0) {
        childRules.push(`.${uid}-spacer-td { ${tdRules.join("; ")} }`);
      }
    }

    // ── List ─────────────────────────────────────────────────────────────────
    else if (compType === "list") {
      pushTextStyles(containerRules);

      if (m.itemSpacing != null) {
        childRules.push(
          `.${uid} li { margin-bottom: ${m.itemSpacing}px !important; }`,
        );
      }
    }

    // ── Menu ─────────────────────────────────────────────────────────────────
    else if (compType === "menu") {
      const tdRules: string[] = [];
      tdRules.push(...resolveMobileBackground());

      if (m.padding) {
        const pd = m.padding;
        tdRules.push(
          `padding: ${pd.top}px ${pd.right}px ${pd.bottom}px ${pd.left}px !important`,
        );
      }

      if (tdRules.length > 0)
        childRules.push(`.${uid}-menu-td { ${tdRules.join("; ")} }`);

      if (m.align != null) {
        childRules.push(
          `.${uid}-menu-td { text-align: ${m.align} !important; }`,
        );
      }

      // Typography only — no margin-left/right here, spacing lives on <td>
      const anchorRules: string[] = [];
      if (m.fontSize != null)
        anchorRules.push(`font-size: ${m.fontSize}px !important`);
      if (m.lineHeight != null)
        anchorRules.push(`line-height: ${m.lineHeight} !important`);

      if (m.letterSpacing != null)
        anchorRules.push(`letter-spacing: ${m.letterSpacing}px !important`);

      if (m.color != null) anchorRules.push(`color: ${m.color} !important`);
      if (m.fontWeight != null)
        anchorRules.push(`font-weight: ${m.fontWeight} !important`);
      if (m.fontFamily != null)
        anchorRules.push(
          `font-family: '${m.fontFamily}', Arial, sans-serif !important`,
        );
      if (m.fontStyle != null)
        anchorRules.push(`font-style: ${m.fontStyle} !important`);
      if (m.textTransform != null)
        anchorRules.push(`text-transform: ${m.textTransform} !important`);
      if (m.textDecoration != null)
        anchorRules.push(`text-decoration: ${m.textDecoration} !important`);

      if (anchorRules.length > 0)
        childRules.push(`.${uid}-menu-td a { ${anchorRules.join("; ")} }`);

      // Spacing — overrides the <a> margins set inline by the menu renderer.
      //
      // Stacked (mobileStack): items become block-level and stack vertically,
      // so the horizontal left/right margins are converted into a single bottom
      // margin — the inter-item gap becomes vertical. The last item gets no
      // bottom margin so there's no trailing gap. Emitted whenever mobileStack
      // is on; it does NOT require a mobile `spacing` override — when one isn't
      // set we fall back to the desktop `spacing` so the gap matches desktop.
      //
      // Horizontal (no stacking): only touch the margins when a mobile-specific
      // `spacing` override exists, since otherwise the desktop inline left/right
      // margins already apply.
      if (mobileStack) {
        const spacing = m.spacing ?? comp.props.spacing ?? 0;
        childRules.push(
          `.${uid}-menu-item a { display: block !important; white-space: normal !important; margin-left: 0 !important; margin-right: 0 !important; margin-bottom: ${spacing}px !important; }`,
        );
        childRules.push(
          `.${uid}-menu-item:last-of-type a { margin-bottom: 0 !important; }`,
        );
      } else if (m.spacing != null) {
        const half = Math.ceil(m.spacing / 2);
        childRules.push(
          `.${uid}-menu-item a { margin-left: ${half}px !important; margin-right: ${half}px !important; }`,
        );
        childRules.push(
          `.${uid}-menu-item:first-of-type a { margin-left: 0 !important; }`,
        );
        childRules.push(
          `.${uid}-menu-item:last-of-type a { margin-right: 0 !important; }`,
        );
      }
    }

    // ── Socials ──────────────────────────────────────────────────────────────
    else if (compType === "socials") {
      const tdRules: string[] = [];

      if (m.padding) {
        const pd = m.padding;
        tdRules.push(
          `padding: ${pd.top}px ${pd.right}px ${pd.bottom}px ${pd.left}px !important`,
        );
      }

      // Alignment
      if (m.align != null) {
        const ml = m.align === "left" ? "0" : "auto";
        const mr = m.align === "right" ? "0" : "auto";

        childRules.push(
          `.${uid}-socials-inner { display:inline-table !important; margin-left: ${ml} !important; margin-right: ${mr} !important; }`,
        );

        tdRules.push(`text-align: ${m.align} !important`);
      }

      if (tdRules.length > 0) {
        childRules.push(`.${uid}-socials-td { ${tdRules.join("; ")} }`);
      }

      // Icon size
      if (m.iconSize != null) {
        childRules.push(
          `.${uid}-socials-inner img { width: ${m.iconSize}px !important; height: ${m.iconSize}px !important; }`,
        );
      }

      // Spacing — margin on <a>, matching desktop HTML
      if (m.spacing != null) {
        const half = Math.ceil(m.spacing / 2);
        childRules.push(
          `.${uid}-socials-item a { margin-left: ${half}px !important; margin-right: ${half}px !important; }`,
        );
        childRules.push(
          `.${uid}-socials-item:first-of-type a { margin-left: 0 !important; }`,
        );
        childRules.push(
          `.${uid}-socials-item:last-of-type a { margin-right: 0 !important; }`,
        );
      }
    }

    // ── Paragraph / Heading (and any future text-block types) ────────────────
    else {
      pushTextStyles(containerRules);
    }

    /* ================================
       BUILD FINAL CSS
    ================================= */

    const blocks: string[] = [];

    if (containerRules.length > 0) {
      blocks.push(`.${uid} { ${containerRules.join("; ")} }`);
    }

    if (elementRules.length > 0) {
      const selector = anchorTypes.has(compType)
        ? `.${uid}-link`
        : compType === "image"
          ? `.${uid} img`
          : compType === "video"
            ? `.${uid} video`
            : `.${uid}`;

      blocks.push(`${selector} { ${elementRules.join("; ")} }`);
    }

    blocks.push(...childRules);

    return blocks.join("\n");
  };

  return { emailMobileStyles };
};
