// Separate simultaneous isolated runs without reusing another task's server.
export const qaPort = Number(process.env.WG_QA_APP_PORT || 8082);
export const controlPort = Number(process.env.WG_QA_CONTROL_PORT || 8099);
export const tlsPort = Number(process.env.WG_QA_TLS_PORT || 8443);
if (
  [qaPort, controlPort, tlsPort].some((p) => !Number.isInteger(p) || p < 1024 || p > 65535) ||
  new Set([qaPort, controlPort, tlsPort]).size !== 3
)
  throw new Error("QA ports must be distinct integers between 1024 and 65535.");
export const qaBase = "http://127.0.0.1:" + qaPort;
export const controlBase = "http://127.0.0.1:" + controlPort;
export const lighthouseBase = "https://127.0.0.1:" + tlsPort;
