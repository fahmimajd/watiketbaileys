/*
 * Helper to lazily load the ESM-only Baileys bundle from our CommonJS runtime.
 * We rely on `new Function` to avoid TypeScript rewriting `import()` into `require()`.
 */
type BaileysModule = typeof import("@whiskeysockets/baileys");

type DynamicImport = (specifier: string) => Promise<BaileysModule>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier);"
) as DynamicImport;

let cachedModulePromise: Promise<BaileysModule> | null = null;

export const getBaileysModule = (): Promise<BaileysModule> => {
  if (!cachedModulePromise) {
    cachedModulePromise = dynamicImport("@whiskeysockets/baileys");
  }
  return cachedModulePromise;
};
