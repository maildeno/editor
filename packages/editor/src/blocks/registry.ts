import type { BlockDefinition } from "./types";

const registry = new Map<string, BlockDefinition>();

/**
 * Registers a block type.
 *
 * ```ts
 * registerBlock({
 *   name: "product-card",
 *   label: "Product Card",
 *   icon: "<svg …>",
 *   schema: { … },
 *   renderCanvas, renderSettings, renderEmail,
 * });
 * ```
 *
 * A two-argument form, `registerBlock(id, definition)`, is also accepted. The
 * definition already carries `name`, so the separate id is redundant — but the
 * built-in blocks are registered that way and external code may be too, so
 * both keep working. When both are given, the explicit id wins.
 */
export function registerBlock(definition: BlockDefinition): void;
export function registerBlock(id: string, definition: BlockDefinition): void;
export function registerBlock(
  idOrDefinition: string | BlockDefinition,
  maybeDefinition?: BlockDefinition,
): void {
  const definition =
    typeof idOrDefinition === "string"
      ? maybeDefinition
      : idOrDefinition;

  if (!definition) {
    console.error(
      "[maildeno-editor] registerBlock was called without a definition.",
    );
    return;
  }

  const id =
    typeof idOrDefinition === "string" ? idOrDefinition : definition.name;

  if (!id) {
    // Registering under `undefined` would "succeed" and then never resolve,
    // which is far harder to diagnose than failing here.
    console.error(
      "[maildeno-editor] registerBlock needs a name — either as the first " +
        "argument or as `name` on the definition.",
    );
    return;
  }

  // Keep `name` in sync with the key, so consumers reading it back (the
  // sidebar uses it as the component type) always get the id it resolves by.
  registry.set(id, { ...definition, name: id });
}

export function getBlock(id: string): BlockDefinition | undefined {
  return registry.get(id);
}

export function getAllBlocks(): ReadonlyMap<string, BlockDefinition> {
  return registry;
}
