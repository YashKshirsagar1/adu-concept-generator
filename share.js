// =====================================================================
// share.js — turns a plan into a short piece of text for a share link, and back.
//
// How: plan -> JSON text -> squeezed (compressed) -> made URL-safe text.
// The link looks like:   https://yoursite.com/#d=eJxVjsEKwj...
// Everything after the "#" stays in the browser; it's never sent to a server.
//
//   encodePlan(plan)  -> "eJxV..."      (async)
//   decodePlan(text)  -> plan object    (async; throws if the text is bad or too big)
//
// The plan inside a link is UNTRUSTED (anyone can edit a link). decodePlan only
// unpacks it; index.html must still run validatePlan() before drawing it.
// =====================================================================

const MAX_LINK_TEXT = 30000;      // longest share text we'll even try to read
const MAX_PLAN_BYTES = 200000;    // biggest plan JSON we'll unpack (protects against "zip bombs")

// Run bytes through the browser's built-in compressor / decompressor.
async function runStream(bytes, stream) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_PLAN_BYTES) { reader.cancel(); throw new Error("Share link is too big."); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  chunks.forEach(c => { out.set(c, pos); pos += c.length; });
  return out;
}

// bytes <-> text that is safe inside a web address (base64url)
function bytesToText(bytes) {
  let binary = "";
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function textToBytes(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function encodePlan(plan) {
  const json = new TextEncoder().encode(JSON.stringify(plan));
  return bytesToText(await runStream(json, new CompressionStream("deflate-raw")));
}

async function decodePlan(text) {
  if (text.length > MAX_LINK_TEXT) throw new Error("Share link is too long.");
  const json = await runStream(textToBytes(text), new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(json));
}
