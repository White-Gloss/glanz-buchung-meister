import { extras, pickupKeramikNote, pickupTierSummary } from "./site";
import { eur } from "@/lib/utils";

function extraEuro(id: string) {
  const extra = extras.find((item) => item.id === id);
  if (!extra) throw new Error(`Zusatzleistung ${id} fehlt im Katalog.`);
  return eur(extra.price);
}

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  /** Original search description, independent of visible editorial copy. */
  seoExcerpt?: string;
  date: string;
  image: string;
  minutes: number;
  sections: { heading: string; paragraphs: string[] }[];
};

export const articles: Article[] = [
  {
    slug: "keramikversiegelung-langzeitschutz",
    seoExcerpt:
      "Standzeit laut Produkt und Pflege – nicht als Werbejahre. Was im Paket Keramik steckt, und was die Schicht nicht kann.",
    title: "Keramikversiegelung: wie lange der Schutz wirklich hält",
    excerpt:
      "Wie Produkt und Pflege die Haltbarkeit beeinflussen, was das Paket Keramikschutz enthält und welche Grenzen die Beschichtung hat.",
    date: "2026-08-20",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Wovon die Haltbarkeit abhängt",
        paragraphs: [
          "Die Haltbarkeit einer Keramikversiegelung hängt vom Produkt und der anschließenden Pflege ab. Das Paket Keramikschutz ab 899 € enthält die Lackvorbereitung und die Beschichtung.",
          "Eine feste Haltbarkeit von 5 Jahren sagen wir nicht pauschal zu. Zusätzliche Keramikschichten sind nach Prüfung des Lacks auf Anfrage möglich.",
        ],
      },
      {
        heading: "Was die Schicht leistet",
        paragraphs: [
          "Eine gut vorbereitete Keramik lässt Wasser abperlen, hält den Glanz länger und erleichtert die Wäsche. Sie ist kein Kratzschutz. Steinschläge, Waschstraßenbürsten und grobe Verschmutzung gehen trotzdem ins Material.",
          "Deshalb gehört mehrstufige Lackkorrektur ins Paket: Ohne gleichmäßigen Klarlack hält keine Beschichtung das, was sie verspricht. Rechnen Sie mit rund zwei Tagen in der Werkstatt in Horb am Neckar.",
        ],
      },
      {
        heading: "Pflege danach",
        paragraphs: [
          "Die ersten sieben Tage nicht waschen. Regen in dieser Zeit ist kein Problem. Danach Handwäsche mit pH-neutralem Shampoo. Bürstenanlagen erzeugen neue feine Waschkratzer in der Keramik genauso wie im Klarlack.",
          "Der Hol- und Bringservice bis 60 km ist im Paket Keramikschutz enthalten. Wir holen Ihr Fahrzeug in Horb, Nagold, Tübingen und den weiteren Abholorten ab. Die Aufbereitung erfolgt in unserer Werkstatt.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-kosten",
    seoExcerpt:
      "Startpreis, was den Aufwand treibt und warum die Vorbereitung den Preis entscheidet – ohne Showroom-Versprechen.",
    title: "Was kostet eine Keramikversiegelung in Horb am Neckar?",
    excerpt:
      "Welche Leistungen im Preis enthalten sind und wie Fahrzeuggröße, Lackzustand und Vorbereitung den Aufwand beeinflussen.",
    date: "2026-08-12",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Der Startpreis ist kein Endpreis",
        paragraphs: [
          "Bei White Gloss beginnt die Keramikversiegelung im Paket Keramikschutz ab 899 €. Dieser Betrag gilt für die Kompaktklasse bei einem Lackzustand, der die notwendige Vorbereitung zulässt.",
          "SUV, Limousine und Transporter werden mit einem festen Faktor kalkuliert. Entscheidend bleibt der Zustand: ausgeprägte feine Waschkratzer, alte Wachsschichten oder Steinschläge verlängern die Korrektur – und damit die Arbeitszeit.",
        ],
      },
      {
        heading: "Wofür Sie bezahlen",
        paragraphs: [
          "Der größte Teil der Zeit entfällt nicht auf das Auftragen der Keramik, sondern auf Reinigung, Entfernung von Ablagerungen und Lackkorrektur. Ohne diese Schritte haftet die Beschichtung ungleichmäßig.",
          "Im Paket enthalten sind außerdem Glas- und Felgenversiegelung, Lederpflege und der Hol- und Bringservice bis 60 km. Rechnen Sie mit rund zwei Tagen.",
        ],
      },
      {
        heading: "Wann sich die Investition lohnt",
        paragraphs: [
          "Sinnvoll ist Keramik, wenn das Fahrzeug regelmäßig gewaschen wird und der Lack noch genug Klarlack für eine Korrektur hat. Bei einem Gebrauchtwagen ist der visuelle Unterschied oft größer als beim Neuwagen.",
          "Nicht sinnvoll ist sie als Kratzschutz. Die Beschichtung erleichtert die Pflege, macht den Lack aber nicht unempfindlich gegen Steinschläge oder Waschstraßenbürsten.",
        ],
      },
    ],
  },
  {
    slug: "lackkorrektur-swirls",
    seoExcerpt:
      "Waschkratzer, Hologramme und Grenzen der Politur. Wann eine Stufe reicht und wann mehrstufig gearbeitet werden muss.",
    title: "Lackkorrektur: Was Swirls wirklich sind – und was Politur leistet",
    excerpt:
      "Waschkratzer, Hologramme und Grenzen der Politur. Wann eine Stufe reicht und wann mehrstufig gearbeitet werden muss.",
    date: "2026-07-28",
    image: "/media/lack.webp",
    minutes: 5,
    sections: [
      {
        heading: "Wie feine Waschkratzer entstehen",
        paragraphs: [
          "Feine, kreisförmige Kratzer im Klarlack entstehen typischerweise durch Bürstenanlagen, schmutzige Schwämme oder trockenes Reiben. Sie streuen Licht und lassen den Lack milchig oder holografisch wirken.",
          "Bei der Politur wird eine dünne Schicht Klarlack kontrolliert abgetragen, um feine Kratzer zu reduzieren. Wir prüfen vorab, ob die Lackschicht für die Bearbeitung geeignet ist.",
        ],
      },
      {
        heading: "Einstufig oder mehrstufig",
        paragraphs: [
          "Eine einstufige Politur gehört zum Paket Reinigung & Politur und reicht oft, wenn der Lack gepflegt und nur leicht verkratzt ist.",
          "Mehrstufige Korrektur ist Teil des Pakets Keramikschutz. Sie ist aufwendiger, weil grobe Kratzer zuerst nivelliert und anschließend fein nachpoliert werden. Ohne diese Vorbereitung hält eine Keramik nicht das, was sie verspricht.",
        ],
      },
    ],
  },
  {
    slug: "innenraumreinigung-gerueche",
    seoExcerpt:
      "Warum Lufterfrischer scheitern, wann Ozon sinnvoll ist und wie materialgerechte Reinigung Sitze und Kunststoffe schont.",
    title: "Innenraumreinigung: Gerüche lösen, nicht überdecken",
    excerpt:
      "Wie wir Geruchsursachen behandeln und Sitze und Kunststoffe reinigen. Eine Ozonbehandlung kann die Reinigung ergänzen.",
    date: "2026-07-09",
    image: "/media/leder.webp",
    minutes: 5,
    sections: [
      {
        heading: "Geruch hat immer eine Quelle",
        paragraphs: [
          "Nikotin, Feuchtigkeit, verschüttete Getränke oder ein nasser Teppich setzen sich in Schaumstoff und Klimakanälen fest. Ein Duftbaum überdeckt das, entfernt aber nichts.",
          `Wir reinigen zuerst Sitze, Teppiche, Fußräume und Verkleidungen materialgerecht. Bleibt ein Geruch, folgt eine Ozonbehandlung für ${extraEuro("ozon")} zusätzlich.`,
        ],
      },
      {
        heading: "Was Ozon kann – und was nicht",
        paragraphs: [
          "Ozon bricht Geruchsmoleküle auf. Es ersetzt keine Nassreinigung und macht ein verschimmeltes Interieur nicht neu. Nach der Behandlung muss das Fahrzeug gelüftet werden.",
          "Nach der Reinigung pflegen wir Lederflächen mit geeigneten Produkten, um das Material vor dem Austrocknen zu schützen. Ungeeignete Reinigungsmittel können es angreifen.",
        ],
      },
    ],
  },
  {
    slug: "hol-und-bringservice",
    seoExcerpt: `Kostenlos bis zur ersten Staffel, klare Preise laut aktueller Abholtabelle, Paket Keramik inklusive. Ausführung immer in der Werkstatt in Horb am Neckar.`,
    title: "Hol- und Bringservice: So funktioniert die Abholung um Horb",
    excerpt: `Kostenlose Abholung bis 10 km, weitere Entfernungen nach Preistabelle. Im Paket Keramikschutz ist der Service bis 60 km enthalten.`,
    date: "2026-06-22",
    image: "/media/hero.webp",
    minutes: 4,
    sections: [
      {
        heading: "Warum wir nicht vor Ort arbeiten",
        paragraphs: [
          "Lackkorrektur, Keramik und Innenraumreinigung brauchen geeignete Beleuchtung, eine geregelte Wasserversorgung und geschützte Bedingungen zum Ablüften. Deshalb holen wir das Fahrzeug ab und arbeiten in Horb am Neckar.",
          "Das spart Ihnen Wartezeit vor Ort und hält die Qualität unabhängig vom Wetter.",
        ],
      },
      {
        heading: "Preise für die Abholung",
        paragraphs: [
          `${pickupTierSummary()}.`,
          `${pickupKeramikNote()}. Zu unseren Abholorten zählen Tübingen, Nagold, Freudenstadt, Böblingen und Sindelfingen. Für Entfernungen außerhalb des regulären Abholradius gelten die genannten Bedingungen.`,
        ],
      },
    ],
  },
  {
    slug: "leasingrueckgabe-checkliste",
    seoExcerpt:
      "Innenraum, Felgen, Lackbilder – und was sich vor dem Termin noch lohnt. Kein Showroom-Ideal, sondern priorisierte Arbeit.",
    title: "Leasingrückgabe: Welche Spuren Gutachter wirklich sehen",
    excerpt:
      "Welche Gebrauchsspuren an Innenraum, Felgen und Lack vor der Rückgabe geprüft werden sollten und welche Arbeiten sinnvoll sein können.",
    date: "2026-06-04",
    image: "/media/felgen.webp",
    minutes: 5,
    sections: [
      {
        heading: "Nicht alles muss perfekt sein",
        paragraphs: [
          "Leasinggutachter bewerten Gebrauchsspuren anhand festgelegter Kriterien. Tiefe Kratzer an Türen, starke Innenraumverschmutzung und Felgenschäden fallen auf. Leichte Waschkratzer oft weniger.",
          "Wir priorisieren die Stellen, die typischerweise zu Nachforderungen führen, und sagen offen, welche Spuren bleiben.",
        ],
      },
      {
        heading: "Zeitpunkt",
        paragraphs: [
          "Zwei Wochen vor der Rückgabe ist ein sinnvolles Fenster: genug Zeit für Nacharbeit, mit ausreichend Abstand zur erneuten Nutzung im Alltag.",
          "Für Autohäuser und Flotten erstellen wir individuelle Angebote nach Leistungsumfang und Fahrzeuganzahl.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-pflege",
    seoExcerpt:
      "Nicht waschen, nicht abreiben, pH-neutral bleiben. Was die Beschichtung hält – und was sie zerstört.",
    title: "Keramikversiegelung pflegen: die ersten sieben Tage und danach",
    excerpt:
      "Hinweise zur Aushärtung, zur Handwäsche mit pH-neutralem Shampoo und zum schonenden Umgang mit der Beschichtung.",
    date: "2026-05-18",
    image: "/media/keramik.webp",
    minutes: 4,
    sections: [
      {
        heading: "Die Aushärtung",
        paragraphs: [
          "In den ersten etwa sieben Tagen sollte das Fahrzeug nicht gewaschen werden. Regen schadet in dieser Zeit nicht. Vermeiden Sie Autobahn-Insekten auf frischer Beschichtung, soweit planbar.",
          "Kein Politurmittel, kein entfettender Felgenreiniger auf lackierten Flächen, kein Trocknen mit verschmutzten Tüchern.",
        ],
      },
      {
        heading: "Alltag danach",
        paragraphs: [
          "Handwäsche mit pH-neutralem Shampoo erhält den Abperleffekt. Bürstenanlagen erzeugen neue feine Waschkratzer in der Keramik genauso wie im Klarlack.",
          "Eine jährliche Kontrolle in der Werkstatt zeigt, ob eine Auffrischung reicht oder ob Stellen nachbeschichtet werden sollten.",
        ],
      },
    ],
  },
  {
    slug: "lackkorrektur-swirls-kratzer-politur",
    seoExcerpt:
      "Wann eine Stufe reicht, wann mehrstufig gearbeitet wird und welche Kratzer Politur nicht schließt. Mit den Startpreisen aus der Horber Werkstatt.",
    title: "Lackkorrektur bei Swirls und Kratzern – was Politur in Horb leistet",
    excerpt:
      "Wann eine Stufe reicht, wann mehrstufig gearbeitet wird und welche Kratzer Politur nicht schließt. Mit den Startpreisen aus der Horber Werkstatt.",
    date: "2026-04-30",
    image: "/media/lack.webp",
    minutes: 7,
    sections: [
      {
        heading: "Was Politur kann – und wo sie endet",
        paragraphs: [
          "Feine Waschkratzer, auch Swirls genannt, liegen im Klarlack. Eine kontrollierte Politur trägt so wenig Material ab, dass das Licht wieder gleichmäßig reflektiert. Tiefe Kratzer bis zur Grundierung oder ins Blech schließt sie nicht.",
          "Bei White Gloss gehört die einstufige Lackpolitur zum Paket Reinigung & Politur ab 349 €. Mehrstufige Korrektur ist Teil des Pakets Keramikschutz ab 899 €. Der Faktor SUV/Limousine beträgt 1,25, Transporter 1,55.",
        ],
      },
      {
        heading: "Vor der Arbeit",
        paragraphs: [
          "Wir prüfen das Lackbild unter Werkstattlicht. Ist die Lackschicht für eine Korrektur zu dünn, erklären wir Ihnen dies vor der Behandlung.",
          "Parkdellen und Steinschläge gehören nicht in die Politur. Dafür gibt es Smart Repair nach Begutachtung – ohne Pauschalpreis, weil jeder Schaden anders liegt.",
        ],
      },
    ],
  },
  {
    slug: "innenraumreinigung-komplettguide-auto",
    seoExcerpt:
      "Sitze, Teppiche, Kunststoffe, Leder und Gerüche – materialgerecht statt Duftbaum. Ozon nur, wenn die Quelle beseitigt ist.",
    title: "Innenraumreinigung: der Ablauf in der Werkstatt Horb",
    excerpt:
      "So reinigen und pflegen wir Sitze, Teppiche, Kunststoffe und Leder. Vor einer Ozonbehandlung muss die Geruchsursache beseitigt werden.",
    date: "2026-04-18",
    image: "/media/leder.webp",
    minutes: 6,
    sections: [
      {
        heading: "Der Ablauf der Innenraumreinigung",
        paragraphs: [
          "Zuerst grober Schmutz, dann Nassreinigung der textilen Flächen, dann Kunststoffe, dann Leder. Ohne diese Reihenfolge verschmieren Rückstände.",
          `Das Paket Basisreinigung enthält Aussaugen und Entstauben. Das Paket Reinigung & Politur ergänzt die Tiefenreinigung von Textilien. Lederpflege kostet zusätzlich ${extraEuro("leder")}, Geruchsbehandlung mit Ozon (Ozon) ${extraEuro("ozon")}.`,
        ],
      },
      {
        heading: "Geruchsbehandlung in unserer Werkstatt",
        paragraphs: [
          "Nikotin und Feuchtigkeit sitzen im Schaumstoff. Ozon bricht Moleküle, ersetzt aber keine Nassreinigung. Nach der Behandlung muss das Fahrzeug gelüftet werden.",
          `${pickupTierSummary()}. Die Aufbereitung erfolgt an der Adresse Arnistal 27 in Horb am Neckar.`,
        ],
      },
    ],
  },
  {
    slug: "smart-repair-oder-lackkorrektur",
    seoExcerpt:
      "Parkdellen, Steinschläge, Swirls: welche Methode zum Schaden passt – und warum Politur keine Delle schließt.",
    title: "Smart Repair oder Lackkorrektur – wann was in Horb greift",
    excerpt:
      "Welche Behandlung für einzelne Schäden oder feine Waschkratzer infrage kommt und wo die Grenzen einer Politur liegen.",
    date: "2026-04-05",
    image: "/media/dellen.webp",
    minutes: 6,
    sections: [
      {
        heading: "Zwei unterschiedliche Verfahren",
        paragraphs: [
          "Smart Repair bearbeitet einzelne Stellen: Parkdellen ohne Lackbruch, kleine Steinschläge, begrenzte Kratzer. Lackkorrektur arbeitet flächig am Klarlack.",
          "Eine Politur kann tiefe Kratzer bis ins Blech nicht reparieren. Punktuelle Reparaturen ersetzen wiederum keine flächige Politur bei vielen feinen Waschkratzern.",
        ],
      },
      {
        heading: "Wie wir in Horb entscheiden",
        paragraphs: [
          "Dellen und Hagelschäden begutachten wir zuerst – oft per Foto, verbindlich erst am Fahrzeug. Es gibt keinen Katalogpreis, weil Zugänglichkeit und Lackzustand den Aufwand bestimmen.",
          "Feine Waschkratzer behandeln wir im Paket Reinigung & Politur ab 349 € oder mit der mehrstufigen Lackkorrektur im Paket Keramikschutz ab 899 €. Beides lässt sich kombinieren, wenn Einzelschäden und Flächenbild zusammenkommen.",
        ],
      },
    ],
  },
  {
    slug: "leasingrueckgabe-aufbereitung-vermeiden-mehrkosten",
    seoExcerpt:
      "Was Gutachter typischerweise sehen, was Politur noch rettet und warum zwei Wochen vor dem Termin sinnvoll sind.",
    title: "Leasingrückgabe: Aufbereitung gegen teure Nachforderungen",
    excerpt:
      "Welche Gebrauchsspuren geprüft werden, was eine Politur verbessern kann und warum etwa 2 Wochen Vorlauf sinnvoll sind.",
    date: "2026-03-22",
    image: "/media/hero.webp",
    minutes: 6,
    sections: [
      {
        heading: "Gebrauchsspuren gezielt prüfen",
        paragraphs: [
          "Leasinggutachter bewerten Felgen, Innenraum, Türkanten und tiefe Kratzer. Leichte Waschkratzer fallen oft weniger ins Gewicht als ein verklebter Fußraum.",
          "Wir konzentrieren uns auf Gebrauchsspuren, die bei der Rückgabe zu Nachforderungen führen können. Welche Spuren bleiben, besprechen wir vorab.",
        ],
      },
      {
        heading: "Paketwahl vor der Rückgabe",
        paragraphs: [
          "Das Paket Reinigung & Politur ab 349 € umfasst die Innenraumreinigung und eine einstufige Lackpolitur. Das Paket Keramikschutz lohnt sich nur, wenn das Fahrzeug danach noch länger bleibt.",
          "Für Autohäuser und Flotten rechnen wir B2B ohne Pauschalpreis. Privatkunden aus Horb, Nagold, Rottenburg und Freudenstadt holen wir nach der bekannten Staffel ab.",
        ],
      },
    ],
  },
  {
    slug: "fahrzeugaufbereitung-horb-am-neckar",
    seoExcerpt:
      "Standort Arnistal 27, Hol- und Bringservice in 13 Städten, klare Pakete ab 149 Euro. Warum die Ausführung in Horb bleibt.",
    title: "Fahrzeugaufbereitung in Horb am Neckar – Werkstatt statt Waschstraße",
    excerpt:
      "Standort Arnistal 27, Hol- und Bringservice in 13 Städten, klare Pakete ab 149 €. Warum die Ausführung in Horb bleibt.",
    date: "2026-03-08",
    image: "/media/hero.webp",
    minutes: 5,
    sections: [
      {
        heading: "Ein Standort, 13 Abholorte",
        paragraphs: [
          "White Gloss Detailing arbeitet in Horb am Neckar. Aus Nagold, Rottenburg, Freudenstadt, Tübingen, Herrenberg, Calw, Balingen, Rottweil, Böblingen, Reutlingen, Oberndorf und Sindelfingen holen wir Fahrzeuge ab.",
          `${pickupTierSummary()}. ${pickupKeramikNote()}. Die Politur erfolgt in unserer Werkstatt mit geeigneter Beleuchtung und geschützten Arbeitsbedingungen.`,
        ],
      },
      {
        heading: "Drei Pakete, ein Inhaber",
        paragraphs: [
          "Basisreinigung ab 149 €, Reinigung & Politur ab 349 €, Keramikschutz ab 899 €. Inhaber Lars Hägele, Arnistal 27, 72160 Horb am Neckar.",
          "Anfragen über den Konfigurator, telefonisch unter 0152 33540284 oder per WhatsApp. Unverbindlich, Endpreis nach Begutachtung, wenn der Zustand mehr verlangt.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-lackvorbereitung-pflege",
    seoExcerpt:
      "Haftung entscheidet sich in der Vorbereitung. Sieben Tage nicht waschen, danach pH-neutral. Start ab 899 Euro in Horb.",
    title: "Keramikversiegelung vorbereiten und pflegen",
    excerpt:
      "Haftung entscheidet sich in der Vorbereitung. Sieben Tage nicht waschen, danach pH-neutral. Start ab 899 € in Horb.",
    date: "2026-02-20",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Warum die Lackvorbereitung wichtig ist",
        paragraphs: [
          "Keramik verbindet sich mit sauberem, gleichmäßigem Klarlack. Deshalb gehört mehrstufige Korrektur ins Paket Keramikschutz ab 899 €, nicht nur das Auftragen der Schicht.",
          `Rechnen Sie mit rund zwei Tagen. Glas- und Felgenversiegelung sowie Lederpflege sind enthalten. ${pickupKeramikNote()}.`,
        ],
      },
      {
        heading: "Die ersten sieben Tage",
        paragraphs: [
          "Nicht waschen, nicht mit verschmutzten Tüchern abreiben. Regen schadet in dieser Zeit nicht. Kein Felgenreiniger auf lackierten Flächen.",
          "Danach Handwäsche mit pH-neutralem Shampoo. Bürstenanlagen erzeugen neue Kratzer in der Keramik. Die Beschichtung ist nicht kratzfest.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
