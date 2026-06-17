import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { schemaUrls } from "./index.js";

describe("protocol schemas", () => {
  it.each(Object.entries(schemaUrls))("loads the %s schema", async (_name, url) => {
    const schema = JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(typeof schema.$id).toBe("string");
    expect(schema.type).toBe("object");
  });
});

