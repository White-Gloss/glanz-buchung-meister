import { absUrl, SITE_URL } from "./seo";

export type ServicePage = {
  slug: string;
  name: string;
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
  detail: string;
  benefits: string[];
  process: { title: string; text: string }[];
  faq: [string, string][];
  relatedPackageIds: string[];
};

export const servicePages: ServicePage[] = [
  {
    slug: "innenraumreinigung",
    name: "Innenraumreinigung",
    eyebrow: "Sauberkeit bis in jede Fuge",
    title: "Professionelle Innenraumreinigung in Horb am Neckar",
    metaTitle: "Auto-Innenraumreinigung Horb am Neckar | White Gloss",
    metaDescription:
      "Professionelle Auto-Innenraumreinigung in Horb: Sitze, Teppiche, Kunststoff und schwer erreichbare Bereiche gründlich reinigen lassen.",
    lead: "Wir reinigen Sitze, Teppiche, Verkleidungen, Kunststoffflächen und schwer erreichbare Zwischenräume materialgerecht und mit Blick auf jedes Detail.",
    detail:
      "Alltag, Haustiere, Kinder und viele Fahrkilometer hinterlassen sichtbare und unsichtbare Spuren. Vor Beginn prüfen wir Material, Verschmutzung und Fleckenbild. So erhält jede Oberfläche die Behandlung, die zu ihrem Zustand passt – ohne unnötig aggressive Mittel.",
    benefits: [
      "Gründliche Reinigung von Sitzen, Teppichen und Fußräumen",
      "Materialgerechte Pflege von Kunststoff und Verkleidungen",
      "Gezielte Behandlung typischer Flecken und Gebrauchsspuren",
      "Optionale Geruchsneutralisierung mit Ozonbehandlung",
    ],
    process: [
      {
        title: "Innenraum prüfen",
        text: "Wir erfassen Materialien, Flecken, Geruchsquellen und besonders beanspruchte Bereiche.",
      },
      {
        title: "Trockenreinigung",
        text: "Lose Verschmutzungen werden gründlich abgesaugt und aus Fugen sowie Zwischenräumen gelöst.",
      },
      {
        title: "Tiefenreinigung",
        text: "Textilien und Oberflächen werden passend zum Material gereinigt und sorgfältig nachgearbeitet.",
      },
      {
        title: "Endkontrolle",
        text: "Nach Trocknung und Finish kontrollieren wir alle Flächen bei gleichmäßiger Beleuchtung.",
      },
    ],
    faq: [
      [
        "Wie lange dauert eine Innenraumreinigung?",
        "Je nach Fahrzeuggröße und Zustand dauert die Innenraumreinigung meist mehrere Stunden. Im Online-Konfigurator sehen Sie die geplante Paketdauer.",
      ],
      [
        "Können alle Flecken vollständig entfernt werden?",
        "Viele typische Verschmutzungen lassen sich deutlich reduzieren oder entfernen. Das Ergebnis hängt jedoch von Material, Alter und Vorbehandlung des Flecks ab.",
      ],
      [
        "Hilft eine Ozonbehandlung gegen Gerüche?",
        "Ozon kann nach der eigentlichen Reinigung zur Geruchsneutralisierung eingesetzt werden. Zuerst muss jedoch die Ursache des Geruchs beseitigt werden.",
      ],
      [
        "Kann mein Fahrzeug abgeholt werden?",
        "Ja. Für Horb am Neckar und zahlreiche Städte der Region steht ein Hol- und Bringservice zur Verfügung.",
      ],
    ],
    relatedPackageIds: ["basis", "premium", "keramik"],
  },
  {
    slug: "lackkorrektur",
    name: "Lackkorrektur",
    eyebrow: "Mehr Tiefe, Klarheit und Glanz",
    title: "Lackkorrektur und Autopolitur in Horb am Neckar",
    metaTitle: "Lackkorrektur & Autopolitur Horb | White Gloss",
    metaDescription:
      "Professionelle Lackkorrektur und Autopolitur in Horb am Neckar: Waschkratzer, Hologramme und matte Lackbilder gezielt reduzieren.",
    lead: "Eine professionelle Lackkorrektur reduziert Waschkratzer, Hologramme und matte Bereiche, damit Farbe, Tiefe und Reflexion wieder sichtbar werden.",
    detail:
      "Nicht jeder Lack benötigt die gleiche Bearbeitung. Wir beurteilen Zustand und Defekte zuerst unter kontrollierter Beleuchtung. Anschließend wählen wir Polierkombination und Korrekturstufe so, dass ein sichtbares Ergebnis bei verantwortungsvollem Materialabtrag entsteht.",
    benefits: [
      "Gezielte Reduzierung von Swirls und Waschkratzern",
      "Mehr Farbtiefe und gleichmäßige Reflexionen",
      "Angepasste Polierstufe statt pauschaler Bearbeitung",
      "Optimale Vorbereitung für Wachs oder Keramikschutz",
    ],
    process: [
      {
        title: "Waschen und dekontaminieren",
        text: "Schmutz, Flugrost und festsitzende Rückstände werden vor der Politur gründlich entfernt.",
      },
      {
        title: "Lackbild beurteilen",
        text: "Defekte und kritische Bereiche werden unter geeigneter Beleuchtung kontrolliert.",
      },
      {
        title: "Lack korrigieren",
        text: "Politur, Pad und Arbeitsstufe werden passend zum Lackzustand ausgewählt.",
      },
      {
        title: "Finish und Schutz",
        text: "Nach der Endkontrolle erhält der Lack den gewählten Schutz für Glanz und leichtere Pflege.",
      },
    ],
    faq: [
      [
        "Verschwinden tiefe Kratzer durch eine Politur?",
        "Oberflächliche Defekte lassen sich häufig stark reduzieren. Kratzer, die durch den Klarlack reichen, können aus Sicherheitsgründen nicht vollständig auspoliert werden.",
      ],
      [
        "Was ist der Unterschied zwischen Politur und Lackkorrektur?",
        "Eine Glanzpolitur verbessert vor allem das Finish. Eine Lackkorrektur wird gezielt auf vorhandene Defekte und den tatsächlichen Lackzustand abgestimmt.",
      ],
      [
        "Wie bleibt das Ergebnis länger erhalten?",
        "Eine passende Versiegelung sowie schonende Handwäsche helfen, den korrigierten Lack langfristig zu schützen.",
      ],
      [
        "Wie lange dauert die Bearbeitung?",
        "Eine einstufige Politur kann innerhalb eines Arbeitstags erfolgen. Mehrstufige Korrekturen benötigen je nach Fahrzeug und Zustand mehr Zeit.",
      ],
    ],
    relatedPackageIds: ["premium", "keramik"],
  },
  {
    slug: "keramikversiegelung",
    name: "Keramikversiegelung",
    eyebrow: "Langfristiger Lackschutz",
    title: "Keramikversiegelung für Ihr Auto in Horb am Neckar",
    metaTitle: "Keramikversiegelung Auto Horb | White Gloss",
    metaDescription:
      "Keramikversiegelung in Horb am Neckar: professionelle Lackvorbereitung, intensive Glätte und langfristiger Schutz mit Hol- und Bringservice.",
    lead: "Eine Keramikversiegelung verbindet intensiven Glanz mit einer glatten, pflegeleichten Oberfläche und langfristigem Schutz vor typischen Umwelteinflüssen.",
    detail:
      "Die Qualität einer Keramikversiegelung entscheidet sich bei der Vorbereitung. Deshalb wird der Lack gründlich gereinigt, dekontaminiert und je nach Zustand korrigiert. Erst auf einer sauberen, gleichmäßigen Oberfläche kann die Beschichtung zuverlässig haften.",
    benefits: [
      "Stark hydrophobe und leichter zu reinigende Oberfläche",
      "Intensiver Glanz nach sorgfältiger Lackvorbereitung",
      "Schutz vor typischen chemischen und organischen Belastungen",
      "Je nach System und Pflege Schutzdauer von bis zu fünf Jahren",
    ],
    process: [
      {
        title: "Intensive Vorreinigung",
        text: "Lack, Felgen und kritische Bereiche werden vollständig gereinigt und dekontaminiert.",
      },
      {
        title: "Lack vorbereiten",
        text: "Der Lack wird je nach Ausgangszustand poliert und anschließend rückstandsfrei entfettet.",
      },
      {
        title: "Beschichtung auftragen",
        text: "Die Keramik wird kontrolliert verarbeitet und auf gleichmäßige Ablüftung geprüft.",
      },
      {
        title: "Aushärten und übergeben",
        text: "Das Fahrzeug bleibt für die notwendige Aushärtung geschützt und wird abschließend kontrolliert.",
      },
    ],
    faq: [
      [
        "Ist eine Keramikversiegelung kratzfest?",
        "Nein. Sie erleichtert die Pflege und schützt vor vielen Umwelteinflüssen, macht den Lack aber nicht unempfindlich gegen mechanische Kratzer oder Steinschläge.",
      ],
      [
        "Wie lange hält die Versiegelung?",
        "Die Standzeit hängt von System, Nutzung, Pflege und Laufleistung ab. Beim High-End-Paket ist ein Schutz von bis zu fünf Jahren vorgesehen.",
      ],
      [
        "Muss ein Neuwagen vorher poliert werden?",
        "Auch Neuwagen können Transportspuren oder leichte Defekte aufweisen. Vor der Beschichtung wird der Lack geprüft und nur so weit wie nötig vorbereitet.",
      ],
      [
        "Wie pflege ich das Fahrzeug danach?",
        "Schonende Handwäsche, geeignete Reinigungsmittel und regelmäßige Kontrolle unterstützen Glätte, Glanz und Standzeit.",
      ],
    ],
    relatedPackageIds: ["keramik"],
  },
  {
    slug: "lederpflege",
    name: "Lederpflege",
    eyebrow: "Sauber, geschmeidig und geschützt",
    title: "Lederreinigung und Lederpflege in Horb am Neckar",
    metaTitle: "Auto-Lederpflege Horb am Neckar | White Gloss",
    metaDescription:
      "Professionelle Lederreinigung und Lederpflege fürs Auto in Horb: Verschmutzungen materialgerecht lösen und Oberflächen geschützt pflegen.",
    lead: "Wir reinigen und pflegen Fahrzeugsitze sowie Lederflächen materialgerecht, damit Haptik und gleichmäßiges Erscheinungsbild möglichst lange erhalten bleiben.",
    detail:
      "Lenkrad, Sitzwangen und häufig berührte Flächen nehmen Hautfette, Staub und Farbrückstände auf. Eine abgestimmte Reinigung löst diese Belastungen, ohne die Oberfläche unnötig zu strapazieren. Die anschließende Pflege unterstützt Schutz und Geschmeidigkeit.",
    benefits: [
      "Materialgerechte Reinigung beanspruchter Lederflächen",
      "Reduzierung von Glanzstellen durch aufliegende Verschmutzung",
      "Pflege und Schutz nach der gründlichen Reinigung",
      "Besondere Aufmerksamkeit für Sitzwangen und Kontaktflächen",
    ],
    process: [
      {
        title: "Material und Zustand prüfen",
        text: "Wir prüfen Oberfläche, Verschmutzung, Abnutzung und auffällige Verfärbungen.",
      },
      {
        title: "Schonend vorreinigen",
        text: "Lose Partikel werden entfernt, damit sie bei der Nassreinigung nicht scheuern.",
      },
      {
        title: "Leder reinigen",
        text: "Reiniger und Werkzeug werden passend zur Oberfläche eingesetzt und sorgfältig abgenommen.",
      },
      {
        title: "Pflegen und kontrollieren",
        text: "Nach vollständiger Trocknung wird die geeignete Pflege dünn aufgetragen und kontrolliert.",
      },
    ],
    faq: [
      [
        "Kann glänzendes Leder wieder matt werden?",
        "Wenn der Glanz durch Schmutz und Hautfette entsteht, kann eine gründliche Reinigung das ursprüngliche Erscheinungsbild häufig deutlich verbessern.",
      ],
      [
        "Werden Risse oder Abschürfungen repariert?",
        "Die reguläre Lederpflege reinigt und schützt. Tiefe Risse, fehlende Farbe oder strukturelle Schäden benötigen eine gesonderte Lederreparatur.",
      ],
      [
        "Wie oft sollte Autoleder gepflegt werden?",
        "Das hängt von Nutzung, Farbe und Beanspruchung ab. Stark belastete Bereiche sollten regelmäßig kontrolliert und nicht erst bei deutlichen Ablagerungen behandelt werden.",
      ],
      [
        "Ist Lederpflege in einem Paket enthalten?",
        "Im Paket High-End Keramik ist Leder-Konditionierung und Schutz enthalten. Eine umfangreichere Lederpflege kann zusätzlich gewählt werden.",
      ],
    ],
    relatedPackageIds: ["keramik"],
  },
];

export function getServicePage(slug: string) {
  return servicePages.find((service) => service.slug === slug);
}

export function buildServiceJsonLd(service: ServicePage) {
  const canonical = absUrl(`/leistungen/${service.slug}`);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: service.title,
        description: service.metaDescription,
        url: canonical,
        areaServed: {
          "@type": "AdministrativeArea",
          name: "Horb am Neckar und Umgebung",
        },
        provider: {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "White Gloss Detailing",
          url: SITE_URL,
          email: "info@whitegloss.de",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Leistungen",
            item: absUrl("/#leistungen"),
          },
          { "@type": "ListItem", position: 3, name: service.name, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: service.faq.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
