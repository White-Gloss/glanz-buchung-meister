import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 16×16 ICO generated from favicon-48.png — 452 bytes vs the previous 121 KB dump. */
const ICO_B64 =
  "AAABAAEAEBAAAAAAIACuAQAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAXVJREFUeJzNks9PE2EQhp/59le3uy02SPSExYCnGu7wT0BC9N/FGx4waSl6kQQleKCtUBK7LN1vxkNdBQ/GhIO+p8n3zjeZPO9IlKTGA+Qe8vk/H+Ccw8xQXSASEZxziMi9vrA2a5kZZkZZFOTtFiAUxQwzUO/BjChJEBHMDImS1KqqwlQJwpAoCsGMre0txhcjrq+n7OzucFuWjCdfOToa8vHkBO91sVEYN2zl8TLr68+pKk/n0RKrq8/Y3HzJwcFbOp0O3e4ak8mYLMv4NptxdvaZ4fADg8GAMAgcr1/t0Ww2mU6nBEFAo5Gyv/+GLMs5P/9Cv9/He8XMaLfbpGmKmUfkxwZPn6ywsfGCVitndDGiu9bl/fExvV6Pw8N3lLcl3iuXV1fkeU6aNDj9dIoLwgWD+XwOqjVGwjghcI44jilubvDeA4JzgqpiqkRJAjVEEflFVRZNAKp6L7rar+ufMdbR3TXqW/j97W79x0P6W/37Ad8BE1GwZl0ZjiQAAAAASUVORK5CYII=";

const dest = join(dirname(fileURLToPath(import.meta.url)), "../public/favicon.ico");
writeFileSync(dest, Buffer.from(ICO_B64, "base64"));
