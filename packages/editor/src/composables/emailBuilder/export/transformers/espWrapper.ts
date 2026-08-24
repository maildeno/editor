// export/transformers/espWrapper.ts
// Re-exports ESP wrapping logic and provides a unified apply helper.
// Isolating this here means adding a new ESP wrapping strategy only
// requires changes in this file and the underlying wrapper modules.

export { wrapWithESPLogic, type ESPSyntax } from "../logic/espLogicWrapper";
export { wrapWithReactLogic } from "../logic/reactLogicWrapper";
