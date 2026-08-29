import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listPublishedGalleryItems,
  galleryPublicUrl,
  type GalleryItemRow,
} from "@/lib/gallery.functions";
import { heroImageSources } from "@/lib/heroImage";

/**
 * Vorher/Nachher-Referenzgalerie auf der Startseite.
 *
 * Lädt erst nach dem ersten Rendern (kein Server-Loader auf der
 * Startseite) — dieselbe Zurückhaltung wie beim Buchungsassistenten:
 * die Galerie ist kein Inhalt, der den ersten Seitenaufbau (LCP) blockieren
 * sollte, gerade weil sie mehrere Bilder gleichzeitig lädt.
 *
 * Sind keine veröffentlichten Kundenfotos vorhanden, zeigen wir das
 * Atelierfahrzeug aus den bestehenden Hero-Assets. Keine erfundenen
 * Kundenfahrzeuge, keine leere Sektion.
 */
export function VehicleGallery() {
  const [items, setItems] = useState<GalleryItemRow[] | null>(null);
  const fetchItems = useServerFn(listPublishedGalleryItems);

  useEffect(() => {
    void fetchItems({})
      .then(setItems)
      .catch(() => setItems([]));
  }, [fetchItems]);

  if (items === null) return null;

  const published = items.length > 0;

  return (
    <section className="content-auto border-y border-border bg-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <p className="eyebrow">Ergebnisse</p>
        <h2 className="display-section mt-3 uppercase">
          {published ? "Details, die den Unterschied machen." : "Referenz aus dem Atelier."}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          {published
            ? "Eine Auswahl aufbereiteter Fahrzeuge – direkt aus unserer Werkstatt in Horb am Neckar."
            : "Atelierfahrzeug unter Werkstattlicht in Horb am Neckar. Kein Kundenfahrzeug. Kundenreferenzen veröffentlichen wir nur mit Freigabe und ohne Kennzeichen."}
        </p>

        {published ? (
          <div className="mt-10 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <figure key={item.id}>
                <div className="aspect-video overflow-hidden border border-border bg-secondary/30">
                  <img
                    src={galleryPublicUrl(item.storage_path)}
                    alt={item.title || item.vehicle || "Aufbereitetes Fahrzeug"}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
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
        ) : (
          <figure className="mt-10">
            <div className="aspect-[2/1] overflow-hidden border border-border bg-secondary/30">
              <picture>
                <source
                  type="image/avif"
                  media={heroImageSources.mobile.media}
                  srcSet={heroImageSources.mobile.src}
                  width={heroImageSources.mobile.width}
                  height={heroImageSources.mobile.height}
                />
                <img
                  src={heroImageSources.desktop.src}
                  alt="Atelierfahrzeug von White Gloss unter Werkstattlicht in Horb am Neckar"
                  width={heroImageSources.desktop.width}
                  height={heroImageSources.desktop.height}
                  className="size-full object-cover object-[center_30%]"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </picture>
            </div>
            <figcaption className="mt-3 text-xs text-muted-foreground">
              Atelierfahrzeug in Horb. Kein Kundenfahrzeug.
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
