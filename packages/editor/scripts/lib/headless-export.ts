/**
 * headless-export.ts
 *
 * Runs the real export engine without a browser, so scripts can export a
 * template to HTML, MJML and React Email. Used by export-template.ts and the
 * check-export-hooks.ts checks.
 *
 * Import it from a script that is run from packages/editor, so tsx picks up
 * tsconfig.json (the `@/` import alias used inside src).
 */

import { computed, ref } from "vue";
import { register } from "node:module";
import { useEmailExportEngine } from "../../src/composables/emailBuilder/export/useEmailExportEngine";
import { htmlGenerator } from "../../src/composables/emailBuilder/export/generators/html";
import { mjmlGenerator } from "../../src/composables/emailBuilder/export/generators/mjml";
import { reactEmailGenerator } from "../../src/composables/emailBuilder/export/generators/react-email";
import {
  hydrateCanvas,
  hydrateRows,
} from "../../src/composables/emailBuilder/transform/pipeline/hydrate";

export interface HeadlessExports {
  html: string;
  mjml: string;
  jsx: string;
}

// The app registers the built-in blocks when the editor mounts (EmailEditor.vue).
// Without it every leaf component would export as an empty div. The block
// definitions import .vue renderers, which Node cannot load, so they are stubbed
// first (see vue-stub-hooks.mjs). The import is dynamic so the hook is in place.
register("./vue-stub-hooks.mjs", import.meta.url);
const { registerBuiltInBlocks } = await import("../../src/blocks");
registerBuiltInBlocks();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Exports saved-form rows and canvas (what getJson() returns) to all three
 * formats. The inputs are cloned, so callers can reuse them.
 */
export const exportTemplate = async (
  rows: unknown[],
  canvas: unknown,
): Promise<HeadlessExports> => {
  const engine = useEmailExportEngine(
    ref(hydrateRows(clone(rows) as any) as any),
    ref(hydrateCanvas(clone(canvas) as any) as any),
    {
      html: htmlGenerator().generateHTMLComponent,
      react: reactEmailGenerator().generateReactEmailComponent,
      mjml: mjmlGenerator().generateMJMLComponent,
    } as any,
    () => {},
    ref({}) as any,
    computed(() => ({
      mergeTagContext: {},
      mergeTagActive: false,
      linkTagContext: {},
      linkTagActive: false,
    })) as any,
    undefined,
    undefined,
    ref({ syntax: "handlebars" }) as any,
    { open: () => {} } as any,
  );

  return {
    html: String(await engine.getExportedHTML()),
    mjml: String(await engine.getExportedMJML()),
    jsx: String(await engine.getExportedReactEmail()),
  };
};
