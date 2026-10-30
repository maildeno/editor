// builder-stub-hooks.mjs
//
// A Node module-loader hook that replaces useEmailBuilder with a stub that
// only records history commits.
//
// useComponentStyleEditor (and so useNodeStyleEditor) gets saveToHistory from
// useEmailBuilder(), which injects the shared editor instance and throws
// outside a mounted <EmailEditor>. A script that wants to check the style
// editor on its own swaps that one module out and reads the commits it made
// from globalThis.__historyCalls: one entry per saveToHistory(...) call, each
// the argument list of that call (the action name first).

const STUB = `
export const useEmailBuilder = () => ({
  saveToHistory: (...args) => {
    (globalThis.__historyCalls ??= []).push(args);
  },
});
`;

export async function load(url, context, nextLoad) {
  if (/\/emailBuilder\/core\/useEmailBuilder\.(ts|js)$/.test(url)) {
    return { format: "module", source: STUB, shortCircuit: true };
  }
  return nextLoad(url, context);
}
