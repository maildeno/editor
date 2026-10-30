// vue-stub-hooks.mjs
//
// A Node module-loader hook that loads `.vue` files as empty modules.
//
// The built-in block definitions import their canvas renderer components
// (.vue files) next to their export generators. Node cannot load a .vue file,
// and the export engine never uses the components, so scripts that run the
// export engine headlessly stub them out. See headless-export.ts.

export async function load(url, context, nextLoad) {
  if (url.endsWith(".vue")) {
    return {
      format: "module",
      source: "export default {};",
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
