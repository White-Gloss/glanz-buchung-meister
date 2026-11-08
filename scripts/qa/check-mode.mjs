// Pure argument validation; importing this helper never starts a QA server.
export function qaCheckMode(args) {
  const modes = { "--cross-browser-only": "cross-browser", "--studio-only": "studio" };
  if (args.some((argument) => !Object.hasOwn(modes, argument))) throw new Error("Unknown QA mode");
  if (args.length > 1) throw new Error("Choose exactly one QA mode; Studio and cross-browser modes are mutually exclusive");
  return args.length ? modes[args[0]] : "release";
}
