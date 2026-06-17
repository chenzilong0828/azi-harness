export const schemaUrls = {
  project: new URL("../schemas/project.schema.json", import.meta.url),
  manifest: new URL("../schemas/manifest.schema.json", import.meta.url),
  screens: new URL("../schemas/screens.schema.json", import.meta.url)
} as const;

export * from "./specs.js";
