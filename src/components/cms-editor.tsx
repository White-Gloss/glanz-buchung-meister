import { useEffect, useState } from "react";
import { getCmsEditorMode } from "@/lib/cms.functions";
import { WebsiteStudio } from "./website-studio";
import { LegacyCmsEditor, type CmsEditorProps } from "./cms-legacy-editor";
import { Button } from "./ui";

/** The established editor remains available until Studio is explicitly enabled. */
export function CmsEditor(props: CmsEditorProps) {
  const [studio, setStudio] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setStudio(null);
    setError("");
    void getCmsEditorMode().then((mode) => {
      if (active) setStudio(mode.studio);
    }).catch(() => {
      if (active) setError("Die Inhaltsverwaltung konnte nicht geladen werden. Bitte erneut versuchen.");
    });
    return () => { active = false; };
  }, [retry]);
  if (studio === true) return <WebsiteStudio initialKind={props.kind} />;
  if (studio === false) return <LegacyCmsEditor key={props.kind} {...props} />;
  return <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <h1 className="font-display text-4xl">{props.heading}</h1>
    {error ? <><p role="alert" className="mt-4 text-danger">{error}</p><Button type="button" className="mt-4" onClick={() => setRetry((value) => value + 1)}>Erneut laden</Button></> : <p role="status" className="mt-4">Inhaltsverwaltung wird geladen …</p>}
  </main>;
}
