/** Rolldown's short export aliases change when the dependency graph changes. */
export function repairSsrNamespace(source) {
  const exportsNamespace = /\bssr_exports\s+as\s+[\w$]+/.test(source);
  const defined = /\b(?:var|let|const)\s+ssr_exports\b/.test(source);
  if (!exportsNamespace || defined) return source;
  const helper = source.match(/\bvar (__exportAll(?:\$\d+)?)\s*=/)?.[1];
  const at = source.lastIndexOf("export {");
  if (
    !helper ||
    at < 0 ||
    !/\bserver_default\b/.test(source) ||
    !/\bserver_exports\b/.test(source)
  ) {
    throw new Error("SSR-Namespace fehlt; Bundleform kann nicht sicher repariert werden.");
  }
  return (
    source.slice(0, at) +
    `var ssr_exports = ${helper}({\n\tdefault: () => server_default,\n\tt: () => server_exports\n});\n` +
    source.slice(at)
  );
}
