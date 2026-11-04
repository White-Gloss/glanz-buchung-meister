import { Link } from "@tanstack/react-router";
import { customerPhotos } from "@/data/customer-photos";
import type { CityLocalProof } from "@/data/local-proof";
import { services, type City } from "@/data/site";
import { formatProofDate, formatProofMonth } from "@/lib/local-proof";
import { serviceAreaLink } from "@/lib/seo-policy";

/**
 * Operator-confirmed facts that only apply to this pickup area. Rendered only
 * when `localProofFor` returns data, so empty cities keep their current page.
 */
export function CityLocalProofSection({ city, proof }: { city: City; proof: CityLocalProof }) {
  const references = proof.references ?? [];
  const facts = [
    proof.pickupDays ? { label: "Abholtage", value: proof.pickupDays } : null,
    proof.handover ? { label: "Übergabe", value: proof.handover } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <section className="cv-auto border-t border-line" aria-labelledby="ort-nachweis">
      <div className="section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">Aus {city.name}</p>
        <h2 id="ort-nachweis" className="heading-2 mt-4 max-w-3xl">
          Aufträge und Abholung in {city.name}
        </h2>

        {facts.length > 0 ? (
          <dl className="mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="border-l border-line pl-4">
                <dt className="text-xs uppercase tracking-[0.16em] text-subtle">{fact.label}</dt>
                <dd className="mt-2 text-muted leading-relaxed">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {references.length > 0 ? (
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {references.map((ref) => {
              const photo = ref.photoId
                ? customerPhotos.find((p) => p.id === ref.photoId)
                : undefined;
              const service = services.find((s) => s.slug === ref.service);
              return (
                <li
                  key={`${ref.month}-${ref.vehicle}-${ref.service}`}
                  className="border-t border-line pt-5"
                >
                  {photo ? (
                    <img
                      src={photo.src}
                      srcSet={photo.srcSet}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                      width={photo.width}
                      height={photo.height}
                      style={{ objectPosition: photo.position }}
                      alt={`${photo.alt} – Auftrag aus ${city.name}`}
                      loading="lazy"
                      decoding="async"
                      className="mb-5 aspect-[4/3] w-full object-cover"
                    />
                  ) : null}
                  <p className="text-xs uppercase tracking-[0.16em] text-subtle">
                    {formatProofMonth(ref.month)}
                  </p>
                  <h3 className="heading-3 mt-2">{ref.vehicle}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{ref.summary}</p>
                  {service ? (
                    <Link
                      {...serviceAreaLink(service.slug, city.slug)}
                      className="mt-3 inline-flex min-h-11 items-center text-sm text-fg hover:underline"
                    >
                      {service.nav} – Leistungsumfang
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-8 text-xs text-subtle">
          Stand: {formatProofDate(proof.confirmedAt)}.
          {references.length > 0
            ? " Aufträge zeigen wir nur mit Einverständnis der Kunden, ohne Namen und Kennzeichen."
            : null}
        </p>
      </div>
    </section>
  );
}
