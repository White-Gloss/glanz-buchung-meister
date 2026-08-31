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
  date: string;
  image: string;
  minutes: number;
  sections: { heading: string; paragraphs: string[] }[];
};

export const articles: Article[] = [
  {
    slug: "keramikversiegelung-langzeitschutz",
    title: "Keramikversiegelung: wie lange der Schutz wirklich hält",
    excerpt:
      "Standzeit je nach Produkt, nicht pauschal fünf Jahre. Was im Paket Keramik steckt, wann 5 Jahre extra Sinn haben – und was die Schicht nicht kann.",
    date: "2026-08-20",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Keine pauschalen fünf Jahre",
        paragraphs: [
          "Wie lange eine Keramikversiegelung hält, steht auf dem Produkt – nicht auf einem Werbeversprechen. Im Paket Keramik ab 899 Euro ist die Standard-Beschichtung enthalten. Die Standzeit hängt von Lackzustand, Pflege und dem gewählten System ab.",
          "Fünf Jahre sind möglich, aber die teure Variante. Die rechnen wir extra, nach Prüfung des Lacks. Ultra nur auf Anfrage. So bleibt der Preis ehrlich und Sie wissen vorher, was Sie kaufen.",
        ],
      },
      {
        heading: "Was die Schicht leistet",
        paragraphs: [
          "Eine gut vorbereitete Keramik lässt Wasser abperlen, hält den Glanz länger und erleichtert die Wäsche. Sie ist kein Kratzschutz. Steinschläge, Waschstraßenbürsten und grobe Verschmutzung gehen trotzdem ins Material.",
          "Deshalb gehört mehrstufige Lackkorrektur ins Paket: ohne gleichmäßigen Klarlack hält keine Beschichtung, was sie verspricht. Rechnen Sie mit rund zwei Tagen in der Werkstatt in Horb am Neckar.",
        ],
      },
      {
        heading: "Pflege danach",
        paragraphs: [
          "Die ersten sieben Tage nicht waschen. Regen in dieser Zeit ist kein Problem. Danach Handwäsche mit pH-neutralem Shampoo. Bürstenanlagen erzeugen neue Swirls in der Keramik genauso wie im Klarlack.",
          "Hol- und Bringservice bis 60 Kilometer ist im Paket Keramik enthalten. Aus Horb, Nagold, Tübingen und den übrigen Abholstädten kommt das Auto in die Werkstatt – nicht die Politur an die Straße.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-kosten",
    title: "Was kostet eine Keramikversiegelung in Horb am Neckar?",
    excerpt:
      "Startpreis, was den Aufwand treibt und warum die Vorbereitung den Preis entscheidet – ohne Showroom-Versprechen.",
    date: "2026-08-12",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Der Startpreis ist kein Endpreis",
        paragraphs: [
          "Bei White Gloss beginnt die Keramikversiegelung im Paket Keramik ab 899 Euro. Dieser Betrag gilt für die Kompaktklasse bei Lack, der eine nachvollziehbare Vorbereitung noch trägt.",
          "SUV, Limousine und Transporter werden mit einem festen Faktor kalkuliert. Entscheidend bleibt der Zustand: starke Swirls, alte Wachsschichten oder Steinschläge verlängern die Korrektur – und damit die Arbeitszeit.",
        ],
      },
      {
        heading: "Wofür Sie bezahlen",
        paragraphs: [
          "Der größte Teil der Zeit entfällt nicht auf das Auftragen der Keramik, sondern auf Reinigung, Dekontamination und Lackkorrektur. Ohne diese Schritte haftet die Beschichtung ungleichmäßig.",
          "Im Paket enthalten sind außerdem Glas- und Felgenversiegelung, Lederpflege und der Hol- und Bringservice bis 60 Kilometer. Rechnen Sie mit rund zwei Tagen.",
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
    title: "Lackkorrektur: Was Swirls wirklich sind – und was Politur leistet",
    excerpt:
      "Waschkratzer, Hologramme und Grenzen der Politur. Wann eine Stufe reicht und wann mehrstufig gearbeitet werden muss.",
    date: "2026-07-28",
    image: "/media/lack.webp",
    minutes: 5,
    sections: [
      {
        heading: "Swirls entstehen meist in der Wäsche",
        paragraphs: [
          "Feine, kreisförmige Kratzer im Klarlack entstehen typischerweise durch Bürstenanlagen, schmutzige Schwämme oder trockenes Reiben. Sie streuen Licht und lassen den Lack milchig oder holografisch wirken.",
          "Politur trägt Klarlack kontrolliert ab, bis die Kratzer weniger tief sind als die restliche Schicht. Deshalb prüfen wir vorab, ob der Lack die Bearbeitung noch trägt.",
        ],
      },
      {
        heading: "Einstufig oder mehrstufig",
        paragraphs: [
          "Eine einstufige Politur gehört zum Paket Signature und reicht oft, wenn der Lack gepflegt und nur leicht verkratzt ist.",
          "Mehrstufige Korrektur ist Teil des Pakets Keramik. Sie ist aufwendiger, weil grobe Kratzer zuerst nivelliert und anschließend fein nachpoliert werden. Ohne diese Vorbereitung hält eine Keramik nicht, was sie verspricht.",
        ],
      },
    ],
  },
  {
    slug: "innenraumreinigung-gerueche",
    title: "Innenraumreinigung: Gerüche lösen, nicht überdecken",
    excerpt:
      "Warum Lufterfrischer scheitern, wann Ozon sinnvoll ist und wie materialgerechte Reinigung Sitze und Kunststoffe schont.",
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
          "Lederflächen werden nach der Reinigung konditioniert, damit sie nicht austrocknen. Aggressive Chemie glänzt kurz und macht das Material spröde.",
        ],
      },
    ],
  },
  {
    slug: "hol-und-bringservice",
    title: "Hol- und Bringservice: So funktioniert die Abholung um Horb",
    excerpt:
      `Kostenlos bis zur ersten Staffel, klare Preise laut aktueller Abholtabelle, Paket Keramik inklusive. Ausführung immer in der Werkstatt in Horb am Neckar.`,
    date: "2026-06-22",
    image: "/media/hero.webp",
    minutes: 4,
    sections: [
      {
        heading: "Warum wir nicht vor Ort arbeiten",
        paragraphs: [
          "Lackkorrektur, Keramik und Innenraumreinigung brauchen kontrolliertes Licht, Wasserwirtschaft und geschützte Ablüftung. Deshalb holen wir das Fahrzeug ab und arbeiten in Horb am Neckar.",
          "Das spart Ihnen Wartezeit vor Ort und hält die Qualität unabhängig vom Wetter.",
        ],
      },
      {
        heading: "Die Preistafel",
        paragraphs: [
          `${pickupTierSummary()}. Darüber nur auf Anfrage.`,
          `${pickupKeramikNote()}. Städte wie Tübingen, Nagold, Freudenstadt, Böblingen und Sindelfingen liegen in der regelmäßigen Tour.`,
        ],
      },
    ],
  },
  {
    slug: "leasingrueckgabe-checkliste",
    title: "Leasingrückgabe: Welche Spuren Gutachter wirklich sehen",
    excerpt:
      "Innenraum, Felgen, Lackbilder – und was sich vor dem Termin noch lohnt. Kein Showroom-Ideal, sondern priorisierte Arbeit.",
    date: "2026-06-04",
    image: "/media/felgen.webp",
    minutes: 5,
    sections: [
      {
        heading: "Nicht alles muss perfekt sein",
        paragraphs: [
          "Leasinggutachter bewerten Gebrauchsspuren nach Katalogen, nicht nach Instagram. Tiefe Kratzer an Türen, starke Innenraumverschmutzung und Felgenschäden fallen auf. Leichte Waschkratzer oft weniger.",
          "Wir priorisieren die Stellen, die typischerweise zu Nachforderungen führen, und sagen offen, welche Spuren bleiben.",
        ],
      },
      {
        heading: "Zeitpunkt",
        paragraphs: [
          "Zwei Wochen vor der Rückgabe ist ein sinnvolles Fenster: genug Zeit für Nacharbeit, ohne dass neue Alltagsflecken das Ergebnis überholen.",
          "Für Autohäuser und Flotten kalkulieren wir B2B ohne Pauschalpreis – Umfang und Stückzahl bestimmen den Satz.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-pflege",
    title: "Keramikversiegelung pflegen: die ersten sieben Tage und danach",
    excerpt:
      "Nicht waschen, nicht abreiben, pH-neutral bleiben. Was die Beschichtung hält – und was sie zerstört.",
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
          "Handwäsche mit pH-neutralem Shampoo erhält den Abperleffekt. Bürstenanlagen erzeugen neue Swirls in der Keramik genauso wie im Klarlack.",
          "Eine jährliche Kontrolle in der Werkstatt zeigt, ob eine Auffrischung reicht oder ob Stellen nachbeschichtet werden sollten.",
        ],
      },
    ],
  },
  {
    slug: "lackkorrektur-swirls-kratzer-politur",
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
          "Swirls und Waschkratzer liegen im Klarlack. Eine kontrollierte Politur trägt so wenig Material ab, dass das Licht wieder gleichmäßig reflektiert. Tiefe Kratzer bis zur Grundierung oder ins Blech schließt sie nicht.",
          "Bei White Gloss gehört die einstufige Lackpolitur zum Paket Signature ab 349 Euro. Mehrstufige Korrektur ist Teil des Pakets Keramik ab 899 Euro. Der Faktor SUV/Limousine beträgt 1,25, Transporter 1,55.",
        ],
      },
      {
        heading: "Vor der Arbeit",
        paragraphs: [
          "Wir prüfen das Lackbild unter Werkstattlicht. Wenn die Schicht für eine Korrektur nicht mehr trägt, sagen wir das, bevor unnötiger Abtrag entsteht.",
          "Parkdellen und Steinschläge gehören nicht in die Politur. Dafür gibt es Smart Repair nach Begutachtung – ohne Pauschalpreis, weil jeder Schaden anders liegt.",
        ],
      },
    ],
  },
  {
    slug: "innenraumreinigung-komplettguide-auto",
    title: "Innenraumreinigung: der Ablauf in der Werkstatt Horb",
    excerpt:
      "Sitze, Teppiche, Kunststoffe, Leder und Gerüche – materialgerecht statt Duftbaum. Ozon nur, wenn die Quelle beseitigt ist.",
    date: "2026-04-18",
    image: "/media/leder.webp",
    minutes: 6,
    sections: [
      {
        heading: "Reihenfolge statt Chemie-Show",
        paragraphs: [
          "Zuerst grober Schmutz, dann Nassreinigung der textilen Flächen, dann Kunststoffe, dann Leder. Ohne diese Reihenfolge verschmieren Rückstände.",
          `Pur enthält Aussaugen und Entstauben. Signature vertieft Textilien. Lederatelier kostet zusätzlich ${extraEuro("leder")}, Air Pure (Ozon) ${extraEuro("ozon")}.`,
        ],
      },
      {
        heading: "Gerüche aus Horb, Nagold, Tübingen",
        paragraphs: [
          "Nikotin und Feuchtigkeit sitzen im Schaumstoff. Ozon bricht Moleküle, ersetzt aber keine Nassreinigung. Nach der Behandlung muss das Fahrzeug gelüftet werden.",
          `${pickupTierSummary()}. Ausführung bleibt in Arnistal 27.`,
        ],
      },
    ],
  },
  {
    slug: "smart-repair-oder-lackkorrektur",
    title: "Smart Repair oder Lackkorrektur – wann was in Horb greift",
    excerpt:
      "Parkdellen, Steinschläge, Swirls: welche Methode zum Schaden passt – und warum Politur keine Delle schließt.",
    date: "2026-04-05",
    image: "/media/dellen.webp",
    minutes: 6,
    sections: [
      {
        heading: "Zwei Werkzeuge, ein Ziel",
        paragraphs: [
          "Smart Repair bearbeitet einzelne Stellen: Parkdellen ohne Lackbruch, kleine Steinschläge, begrenzte Kratzer. Lackkorrektur arbeitet flächig am Klarlack.",
          "Politur macht aus einem tiefen Kratzer bis ins Blech keinen neuen Lack. Umgekehrt macht Smart Repair aus einem swirligen Gesamtlack kein Showroom-Finish.",
        ],
      },
      {
        heading: "Wie wir in Horb entscheiden",
        paragraphs: [
          "Dellen und Hagelschäden begutachten wir zuerst – oft per Foto, verbindlich erst am Fahrzeug. Es gibt keinen Katalogpreis, weil Zugänglichkeit und Lackzustand den Aufwand bestimmen.",
          "Swirls und Waschkratzer gehören in Signature ab 349 Euro oder in die mehrstufige Korrektur der Keramik ab 899 Euro. Beides lässt sich kombinieren, wenn Einzelschäden und Flächenbild zusammenkommen.",
        ],
      },
    ],
  },
  {
    slug: "leasingrueckgabe-aufbereitung-vermeiden-mehrkosten",
    title: "Leasingrückgabe: Aufbereitung gegen teure Nachforderungen",
    excerpt:
      "Was Gutachter typischerweise sehen, was Politur noch rettet und warum zwei Wochen vor dem Termin sinnvoll sind.",
    date: "2026-03-22",
    image: "/media/hero.webp",
    minutes: 6,
    sections: [
      {
        heading: "Katalog, kein Instagram",
        paragraphs: [
          "Leasinggutachter bewerten Felgen, Innenraum, Türkanten und tiefe Kratzer. Leichte Waschkratzer fallen oft weniger ins Gewicht als ein verklebter Fußraum.",
          "Wir priorisieren die Stellen, die Nachforderungen auslösen, statt ein Showroom-Ideal zu versprechen. Was bleibt, benennen wir vorher.",
        ],
      },
      {
        heading: "Paketwahl vor der Rückgabe",
        paragraphs: [
          "Signature ab 349 Euro deckt Innenraum und einstufige Politur. Das Paket Keramik lohnt sich nur, wenn das Fahrzeug danach noch länger bleibt.",
          "Für Autohäuser und Flotten rechnen wir B2B ohne Pauschalpreis. Privatkunden aus Horb, Nagold, Rottenburg und Freudenstadt holen wir nach der bekannten Staffel ab.",
        ],
      },
    ],
  },
  {
    slug: "fahrzeugaufbereitung-horb-am-neckar",
    title: "Fahrzeugaufbereitung in Horb am Neckar – Werkstatt statt Waschstraße",
    excerpt:
      "Standort Arnistal 27, Hol- und Bringservice in 13 Städten, klare Pakete ab 149 Euro. Warum die Ausführung in Horb bleibt.",
    date: "2026-03-08",
    image: "/media/hero.webp",
    minutes: 5,
    sections: [
      {
        heading: "Ein Standort, 13 Abholorte",
        paragraphs: [
          "White Gloss Detailing arbeitet in Horb am Neckar. Aus Nagold, Rottenburg, Freudenstadt, Tübingen, Herrenberg, Calw, Balingen, Rottweil, Böblingen, Reutlingen, Oberndorf und Sindelfingen holen wir Fahrzeuge ab.",
          `${pickupTierSummary()}. ${pickupKeramikNote()}. Vor Ort an der Straße polieren wir nicht – Licht, Wasser und Ablüftung sind in der Werkstatt.`,
        ],
      },
      {
        heading: "Drei Pakete, ein Inhaber",
        paragraphs: [
          "Pur ab 149 Euro, Signature ab 349 Euro, Keramik ab 899 Euro. Inhaber Lars Hägele, Arnistal 27, 72160 Horb am Neckar.",
          "Anfragen über den Konfigurator, telefonisch unter 0152 33540284 oder per WhatsApp. Unverbindlich, Endpreis nach Begutachtung wenn der Zustand mehr verlangt.",
        ],
      },
    ],
  },
  {
    slug: "keramikversiegelung-lackvorbereitung-pflege",
    title: "Keramikversiegelung vorbereiten und pflegen",
    excerpt:
      "Haftung entscheidet sich in der Vorbereitung. Sieben Tage nicht waschen, danach pH-neutral. Start ab 899 Euro in Horb.",
    date: "2026-02-20",
    image: "/media/keramik.webp",
    minutes: 6,
    sections: [
      {
        heading: "Ohne Korrektur hält nichts, was versprochen wird",
        paragraphs: [
          "Keramik verbindet sich mit sauberem, gleichmäßigem Klarlack. Deshalb gehört mehrstufige Korrektur ins Paket Keramik ab 899 Euro, nicht nur das Auftragen der Schicht.",
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
