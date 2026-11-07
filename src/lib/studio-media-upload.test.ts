import assert from "node:assert/strict";
import test from "node:test";
import { readStudioUpload } from "./studio-media-upload.server.ts";

test("a single browser FormData image reaches the decoder with its original bytes", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File([Uint8Array.from([255, 216, 255])], "foto.jpg", { type: "image/jpeg" }),
  );
  const file = await readStudioUpload(
    new Request("https://example.test/api/studio-media-upload", { method: "POST", body: form }),
  );
  assert.equal(file.name, "foto.jpg");
  assert.equal(file.type, "image/jpeg");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), Uint8Array.from([255, 216, 255]));
});

test("extra form fields and duplicate file uploads are rejected", async () => {
  const form = new FormData();
  form.append("file", new File(["a"], "a.png", { type: "image/png" }));
  form.append("file", new File(["b"], "b.png", { type: "image/png" }));
  await assert.rejects(
    readStudioUpload(new Request("https://example.test/upload", { method: "POST", body: form })),
    /genau eine/,
  );
});

test("the streaming byte limit also applies without a Content-Length header", async () => {
  const request = new Request("https://example.test/upload", {
    method: "POST",
    body: "A".repeat(100),
    headers: { "content-type": "multipart/form-data; boundary=wg" },
  });
  assert.equal(request.headers.get("content-length"), null);
  await assert.rejects(readStudioUpload(request, { maxBytes: 20, timeoutMs: 500 }), /12 MiB/);
});

test("non-multipart and compressed request bodies are rejected before parsing", async () => {
  await assert.rejects(
    readStudioUpload(
      new Request("https://example.test/upload", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    ),
    /Formular/,
  );
  await assert.rejects(
    readStudioUpload(
      new Request("https://example.test/upload", {
        method: "POST",
        body: "compressed",
        headers: { "content-type": "multipart/form-data; boundary=wg", "content-encoding": "gzip" },
      }),
    ),
    /Formular/,
  );
});

test("a stalled upload is cancelled within the bounded read deadline", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull() {
      return new Promise(() => {});
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test/upload", {
    method: "POST",
    body,
    duplex: "half",
    headers: { "content-type": "multipart/form-data; boundary=wg" },
  } as RequestInit);
  await assert.rejects(readStudioUpload(request, { maxBytes: 100, timeoutMs: 10 }), /zu lange/);
  assert.equal(cancelled, true);
});
