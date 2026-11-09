import { useId } from "react";
import type { CmsDocumentContent } from "@/lib/cms.model";
import type { StudioAsset } from "@/lib/studio-media.model";
import { Button, inputClass } from "./ui";
import { moveStudioItem } from "./website-studio-state";

function TextField({
  label,
  value,
  onChange,
  maxLength = 200,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="block space-y-2 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className={`${inputClass} min-h-28 py-3 leading-relaxed`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
        />
      ) : (
        <input
          id={id}
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
        />
      )}
    </div>
  );
}

export function WebsiteStudioFields({
  content,
  assets,
  edit,
  openMedia,
  simple = false,
  leadLabel,
}: {
  content: CmsDocumentContent;
  assets: StudioAsset[];
  edit: (patch: Partial<CmsDocumentContent>) => void;
  openMedia: () => void;
  simple?: boolean;
  leadLabel?: string;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <TextField
          label="Überschrift"
          multiline
          value={content.title}
          onChange={(title) => edit({ title })}
        />
        {(!simple || leadLabel) && (
          <TextField
            label={leadLabel ?? "Kurze Einleitung"}
            value={content.lead}
            onChange={(lead) => edit({ lead })}
            maxLength={leadLabel ? 4000 : 1200}
            multiline
          />
        )}
        <TextField
          label="Text"
          value={content.body}
          onChange={(body) => edit({ body })}
          maxLength={20000}
          multiline
        />
      </div>
      {!simple && (
        <>
          <section className="space-y-5 border-t border-line pt-6">
            <h2 className="font-display text-2xl">Abschnitte</h2>
            {content.sections.map((section, index) => (
              <fieldset key={section.id} className="space-y-4 rounded-md border border-line p-4">
                <legend className="px-2 text-sm">Abschnitt {index + 1}</legend>
                <TextField
                  label="Zwischenüberschrift"
                  value={section.title}
                  onChange={(title) =>
                    edit({
                      sections: content.sections.map((item, position) =>
                        position === index ? { ...item, title } : item,
                      ),
                    })
                  }
                />
                <TextField
                  label="Abschnittstext"
                  value={section.body}
                  multiline
                  maxLength={8000}
                  onChange={(body) =>
                    edit({
                      sections: content.sections.map((item, position) =>
                        position === index ? { ...item, body } : item,
                      ),
                    })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() =>
                      edit({ sections: moveStudioItem(content.sections, index, index - 1) })
                    }
                  >
                    Nach oben
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={index === content.sections.length - 1}
                    onClick={() =>
                      edit({ sections: moveStudioItem(content.sections, index, index + 1) })
                    }
                  >
                    Nach unten
                  </Button>
                  <Button
                    type="button"
                    variant="line"
                    onClick={() =>
                      edit({
                        sections: content.sections.filter((_, position) => position !== index),
                      })
                    }
                  >
                    Abschnitt entfernen
                  </Button>
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="ghost"
              disabled={content.sections.length >= 24}
              onClick={() =>
                edit({
                  sections: [
                    ...content.sections,
                    { id: `section-${crypto.randomUUID()}`, title: "", body: "" },
                  ],
                })
              }
            >
              Abschnitt hinzufügen
            </Button>
          </section>
          <section className="space-y-5 border-t border-line pt-6">
            <h2 className="font-display text-2xl">Fragen und Antworten</h2>
            {content.faqs.map((faq, index) => (
              <div key={index} className="space-y-3 rounded-md border border-line p-4">
                <TextField
                  label={`Frage ${index + 1}`}
                  value={faq.question}
                  maxLength={300}
                  onChange={(question) =>
                    edit({
                      faqs: content.faqs.map((item, position) =>
                        position === index ? { ...item, question } : item,
                      ),
                    })
                  }
                />
                <TextField
                  label="Antwort"
                  value={faq.answer}
                  maxLength={4000}
                  multiline
                  onChange={(answer) =>
                    edit({
                      faqs: content.faqs.map((item, position) =>
                        position === index ? { ...item, answer } : item,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="line"
                  onClick={() =>
                    edit({ faqs: content.faqs.filter((_, position) => position !== index) })
                  }
                >
                  Frage entfernen
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              disabled={content.faqs.length >= 24}
              onClick={() => edit({ faqs: [...content.faqs, { question: "", answer: "" }] })}
            >
              Frage hinzufügen
            </Button>
          </section>
          <section className="space-y-5 border-t border-line pt-6">
            <h2 className="font-display text-2xl">Bilder dieser Seite</h2>
            <p className="text-sm text-muted">
              Reihenfolge und Bildtexte gehören zu diesem Entwurf. Entfernen aus der Seite löscht
              kein Bild aus der Mediathek.
            </p>
            {content.images.map((image, index) => {
              const asset = assets.find((item) => item.id === image.assetId);
              return (
                <div key={image.assetId} className="space-y-4 rounded-md border border-line p-4">
                  {asset && (
                    <img
                      src={asset.previewSrc}
                      alt={image.alt}
                      width={asset.width}
                      height={asset.height}
                      className="max-h-64 w-full object-contain"
                      loading="lazy"
                    />
                  )}
                  <TextField
                    label={`Bild ${index + 1}: Alt-Text`}
                    value={image.alt}
                    maxLength={300}
                    onChange={(alt) =>
                      edit({
                        images: content.images.map((item, position) =>
                          position === index ? { ...item, alt } : item,
                        ),
                      })
                    }
                  />
                  <TextField
                    label="Bildunterschrift"
                    value={image.caption}
                    maxLength={500}
                    onChange={(caption) =>
                      edit({
                        images: content.images.map((item, position) =>
                          position === index ? { ...item, caption } : item,
                        ),
                      })
                    }
                  />
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="hero-image"
                      checked={content.heroAssetId === image.assetId}
                      onChange={() => edit({ heroAssetId: image.assetId })}
                    />
                    Als Titelbild verwenden
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() =>
                        edit({ images: moveStudioItem(content.images, index, index - 1) })
                      }
                    >
                      Bild nach oben
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === content.images.length - 1}
                      onClick={() =>
                        edit({ images: moveStudioItem(content.images, index, index + 1) })
                      }
                    >
                      Bild nach unten
                    </Button>
                    <Button
                      type="button"
                      variant="line"
                      onClick={() =>
                        edit({
                          images: content.images.filter((_, position) => position !== index),
                          heroAssetId:
                            content.heroAssetId === image.assetId ? null : content.heroAssetId,
                        })
                      }
                    >
                      Aus Seite entfernen
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={openMedia}>
                Bild hinzufügen / austauschen
              </Button>
              {content.heroAssetId && (
                <Button type="button" variant="line" onClick={() => edit({ heroAssetId: null })}>
                  Kein eigenes Titelbild
                </Button>
              )}
            </div>
          </section>
          <section className="space-y-5 border-t border-line pt-6">
            <h2 className="font-display text-2xl">Vorschau in der Suche</h2>
            <p className="text-sm text-muted">
              Leere Felder behalten die vorhandenen Suchangaben. Adressen, Indexierungsregeln und
              Canonicals bleiben technisch geschützt.
            </p>
            <TextField
              label="Seitentitel"
              value={content.metaTitle}
              maxLength={160}
              onChange={(metaTitle) => edit({ metaTitle })}
            />
            <TextField
              label="Beschreibung"
              value={content.metaDescription}
              maxLength={320}
              multiline
              onChange={(metaDescription) => edit({ metaDescription })}
            />
          </section>
        </>
      )}
    </div>
  );
}

