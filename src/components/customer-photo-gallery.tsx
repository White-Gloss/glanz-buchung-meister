import { useEffect, useId, useRef, useState } from "react";
import { customerPhotos } from "@/data/customer-photos";
import "@/styles/customer-photos.css";

export function CustomerPhotoGallery() {
  const [category, setCategory] = useState("Alle");
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const categories = ["Alle", ...new Set(customerPhotos.map((photo) => photo.category))];
  const visible = customerPhotos.filter((photo) => category === "Alle" || photo.category === category);
  const photo = active === null ? null : customerPhotos[active];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active !== null && !dialog.open) {
      dialog.showModal();
    } else if (active === null && dialog.open) {
      dialog.close();
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  const isOpen = active !== null;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  function move(direction: number) {
    setActive((current) => current === null ? null : (current + direction + customerPhotos.length) % customerPhotos.length);
  }

  return (
    <>
      <div className="customer-photo-filters" role="group" aria-label="Kundenbilder filtern">
        {categories.map((value) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>
            {value}
          </button>
        ))}
      </div>
      <p className="customer-photo-count" role="status">{visible.length} echte Kundenbilder · Zum Vergrößern auswählen</p>
      <ul className="customer-photo-grid">
        {visible.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="customer-photo-trigger"
              aria-label={`${item.title} – Bild vergrößern`}
              aria-haspopup="dialog"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setActive(customerPhotos.indexOf(item));
              }}
            >
              <img src={item.src} srcSet={item.srcSet} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" width={item.width} height={item.height} alt={item.alt} loading="lazy" decoding="async" />
              <span className="customer-photo-enlarge" aria-hidden="true">Vergrößern ↗</span>
            </button>
            <p className="customer-photo-category">{item.category}</p>
            <h3 className="heading-3">{item.title}</h3>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="customer-photo-dialog"
        aria-labelledby={headingId}
        onCancel={(event) => { event.preventDefault(); setActive(null); }}
        onClose={() => setActive(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        }}
      >
        {photo && active !== null ? (
          <div className="customer-photo-viewer">
            <div className="customer-photo-viewer-head">
              <div>
                <p className="kicker" aria-live="polite">Bild {active + 1} von {customerPhotos.length}</p>
                <h2 id={headingId} className="heading-3">{photo.title}</h2>
              </div>
              <button type="button" onClick={() => setActive(null)} autoFocus aria-label="Bild schließen">Schließen ×</button>
            </div>
            <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} />
            <div className="customer-photo-viewer-controls">
              <button type="button" onClick={() => move(-1)} aria-label="Vorheriges Kundenbild">← Zurück</button>
              <p>{photo.category}</p>
              <button type="button" onClick={() => move(1)} aria-label="Nächstes Kundenbild">Weiter →</button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}