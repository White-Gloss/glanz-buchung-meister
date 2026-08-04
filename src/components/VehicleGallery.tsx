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
 * Lädt erst nach dem ersten Rendern (kein Server-Loader auf der
 * Startseite) — dieselbe Zurückhaltung wie beim Buchungsassistenten:
 * die Galerie ist kein Inhalt, der den ersten Seitenaufbau (LCP) blockieren
 * sollte, gerade weil sie mehrere Bilder gleichzeitig lädt.
 *
 * Rendert komplett unsichtbar (null), solange keine Bilder vorhanden sind —
 * keine leere Sektion mit Überschrift ohne Inhalt.
 */
export function VehicleGallery() {
  const [items, setItems] = useState<GalleryItemRow[] | null>(null);
  const fetchItems = useServerFn(listPublishedGalleryItems);

  useEffect(() => {
    void fetchItems({})
      .then(setItems)
      .catch(() => setItems([]));
  }, [fetchItems]);

  if (items === null || items.length === 0) return null;

  return (
    <section className="content-auto border-y border-border bg-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <p className="eyebrow">Ergebnisse</p>
        <h2 className="display-section mt-3 uppercase">Fahrzeuge aus unserer Werkstatt</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Eine Auswahl aufbereiteter Fahrzeuge — direkt aus Horb am Neckar.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure key={item.id} className="glass overflow-hidden rounded-2xl">
              <div className="aspect-video bg-secondary/30">
                <img
                  src={galleryPublicUrl(item.storage_path)}
                  alt={item.title || item.vehicle || "Aufbereitetes Fahrzeug"}
                  loading="lazy"
                  className="size-full object-cover"
                  width={640}
                  height={360}
                />
              </div>
              {(item.title || item.vehicle) && (
                <figcaption className="p-4">
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
