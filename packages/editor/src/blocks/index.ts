import { registerBlock } from "./registry";
import { buttonBlock } from "./definitions/button";
import { anchorBlock } from "./definitions/anchor";
import { paragraphBlock } from "./definitions/paragraph";
import { headingBlock } from "./definitions/heading";
import { listBlock } from "./definitions/list";
import { imageBlock } from "./definitions/image";
import { videoBlock } from "./definitions/video";
import { dividerBlock } from "./definitions/divider";
import { spacerBlock } from "./definitions/spacer";
import { menuBlock } from "./definitions/menu";
import { socialsBlock } from "./definitions/socials";

let registered = false;

/**
 * Registers every built-in block — all 11, matching the type list confirmed
 * against the real generators back at the start of this migration
 * (paragraph, heading, image, video, list, button, anchor, divider,
 * spacer, menu, socials). Idempotent — safe to call multiple times (e.g.
 * if more than one <EmailEditor> mounts on a page), only registers once.
 */
export function registerBuiltInBlocks(): void {
  if (registered) return;
  registered = true;
  registerBlock("button", buttonBlock);
  registerBlock("anchor", anchorBlock);
  registerBlock("paragraph", paragraphBlock);
  registerBlock("heading", headingBlock);
  registerBlock("list", listBlock);
  registerBlock("image", imageBlock);
  registerBlock("video", videoBlock);
  registerBlock("divider", dividerBlock);
  registerBlock("spacer", spacerBlock);
  registerBlock("menu", menuBlock);
  registerBlock("socials", socialsBlock);
}
