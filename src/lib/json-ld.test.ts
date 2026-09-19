import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeJsonLd } from "./json-ld.ts";

test("CMS text cannot close the JSON-LD script while its content stays intact", () => {
  const payload = { text: '</script><script>alert("x")</script>', title: "Pflege & Glanz" };
  const result = serializeJsonLd(payload);
  assert.equal(result.includes("<"), false);
  assert.deepEqual(JSON.parse(result), payload);
});
