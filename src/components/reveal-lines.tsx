import { Fragment, type ReactNode } from "react";

/**
 * Zeilen einer Headline als Masken für den Zeilen-Reveal (studio.css,
 * Abschnitt 6; ausgelöst in HomePolish). Ersetzt `<br />`: Wortlaut,
 * Zeilenumbruch und Leerzeichen für Screenreader bleiben identisch. Das
 * umgebende Element braucht `data-lines`.
 */
export function RevealLines({ lines }: { lines: ReactNode[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          <span className="reveal-line" style={{ ["--i" as string]: index }}>
            <span>{line}</span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
