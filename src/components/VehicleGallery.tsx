import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listPublishedGalleryItems,
  galleryPublicUrl,
  type GalleryItemRow,
} from "@/lib/gallery.functions";

/**
 * Vorher/Nachher-Referenzgalerie auf der Startseite.
 *
 * Die Galerie liegt unterhalb des sichtbaren Startbereichs. Ihre Datenabfrage
 * wird deshalb bewusst kurz nach hinten geschoben, damit sie beim ersten
 * Laden nicht mit Hero-Bild, Fonts, CSS und Hydration um Netzwerk-/CPU-Zeit
 * konkurriert. Die eigentlichen Galeriebilder bleiben zusätzlich lazy-loaded.
 *
 * Rendert komplett unsichtbar (null), solange keine Bilder vorhanden sind —
 * keine leere Sektion mit Überschrift ohne Inhalt.
 */
export function VehicleGallery() {
  const [items, setItems] = useState<GalleryItemRow[] | null>(null);
  const fetchItems = useServerFn(listPublishedGalleryItems);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void fetchItems({})
        .then((rows) => {
          if (!cancelled) setItems(rows);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    }, 2_500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fetchItems]);

  if (items === null || items.length === 0) return null;

  return (
    <section className="content-auto border-y border-border bg-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="eyebrow">Ergebnisse</p>
        <h2 className="display-section mt-3 uppercase">Details, die den Unterschied machen.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Eine Auswahl aufbereiteter Fahrzeuge – direkt aus unserer Werkstatt in Horb am Neckar.
        </p>

        <div className="mt-10 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure key={item.id}>
              <div className="aspect-video overflow-hidden border border-border bg-secondary/30">
                <img
                  src={galleryPublicUrl(item.storage_path)}
                  alt={item.title || item.vehicle || "Aufbereitetes Fahrzeug"}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                  width={640}
                  height={360}
                />
              </div>
              {(item.title || item.vehicle) && (
                <figcaption className="border-b border-border px-1 py-3">
                  {item.title && (
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                  )}
                  {item.vehicle && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.vehicle}</p>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
