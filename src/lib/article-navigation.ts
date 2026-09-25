import { serviceBookingSelection } from "./booking-selection.ts";

/** Editorial intent and destination; existing URLs and approved images stay intact. */
export const articleNavigation: Record<string, {
  title: string;
  question: string;
  service: string;
  related: string[];
}> = {
  "keramikversiegelung-langzeitschutz": {
    title: "Keramikversiegelung: Haltbarkeit | White Gloss",
    question: "Wie beeinflussen Beschichtung, Nutzung und Pflege die Haltbarkeit?",
    service: "keramikversiegelung",
    related: ["keramikversiegelung-pflege", "keramikversiegelung-kosten", "keramikversiegelung-lackvorbereitung-pflege"],
  },
  "keramikversiegelung-kosten": {
    title: "Keramikversiegelung: Kosten und Umfang | White Gloss",
    question: "Was enthält der Einstiegspreis und wodurch verändert sich der Aufwand?",
    service: "keramikversiegelung",
    related: ["keramikversiegelung-lackvorbereitung-pflege", "keramikversiegelung-langzeitschutz", "keramikversiegelung-pflege"],
  },
  "keramikversiegelung-pflege": {
    title: "Keramikversiegelung richtig pflegen | White Gloss",
    question: "Wie pflege ich mein Fahrzeug nach der Übergabe im Alltag?",
    service: "keramikversiegelung",
    related: ["keramikversiegelung-langzeitschutz", "keramikversiegelung-kosten"],
  },
  "keramikversiegelung-lackvorbereitung-pflege": {
    title: "Lackvorbereitung für Keramikversiegelung | White Gloss",
    question: "Welche Arbeitsschritte braucht der Lack vor der Beschichtung?",
    service: "keramikversiegelung",
    related: ["lackkorrektur-swirls", "keramikversiegelung-kosten", "keramikversiegelung-pflege"],
  },
  "lackkorrektur-swirls": {
    title: "Swirls: Ursachen und passende Politur | White Gloss",
    question: "Wie entstehen feine Waschkratzer und wann passt eine einstufige Politur?",
    service: "lackkorrektur",
    related: ["lackkorrektur-swirls-kratzer-politur", "keramikversiegelung-lackvorbereitung-pflege"],
  },
  "lackkorrektur-swirls-kratzer-politur": {
    title: "Lackkorrektur: Möglichkeiten und Grenzen | White Gloss",
    question: "Welche Kratzer lassen sich behandeln und wann endet die sichere Politur?",
    service: "lackkorrektur",
    related: ["smart-repair-oder-lackkorrektur", "lackkorrektur-swirls", "leasingrueckgabe-aufbereitung-vermeiden-mehrkosten"],
  },
  "innenraumreinigung-gerueche": {
    title: "Gerüche im Auto: Ursachen und Behandlung | White Gloss",
    question: "Warum muss vor einer Ozonbehandlung die Geruchsquelle beseitigt werden?",
    service: "geruchsneutralisation",
    related: ["innenraumreinigung-komplettguide-auto", "fahrzeugaufbereitung-horb-am-neckar"],
  },
  "innenraumreinigung-komplettguide-auto": {
    title: "Innenraumreinigung: Ablauf und Pakete | White Gloss",
    question: "Was unterscheidet Basisreinigung, textile Tiefenreinigung und Zusatzleistungen?",
    service: "innenraumreinigung",
    related: ["innenraumreinigung-gerueche", "leasingrueckgabe-checkliste"],
  },
  "hol-und-bringservice": {
    title: "Hol- und Bringservice um Horb | White Gloss",
    question: "Wie werden Abholung, Übergabe und Entfernungspreis abgestimmt?",
    service: "fahrzeugaufbereitung",
    related: ["fahrzeugaufbereitung-horb-am-neckar", "keramikversiegelung-kosten"],
  },
  "leasingrueckgabe-checkliste": {
    title: "Leasingrückgabe: Checkliste zur Vorbereitung | White Gloss",
    question: "Was sollte ich vor der Rückgabe prüfen und rechtzeitig bereitlegen?",
    service: "leasingrueckgabe",
    related: ["leasingrueckgabe-aufbereitung-vermeiden-mehrkosten", "smart-repair-oder-lackkorrektur", "innenraumreinigung-komplettguide-auto"],
  },
  "leasingrueckgabe-aufbereitung-vermeiden-mehrkosten": {
    title: "Leasingrückgabe: sinnvolle Aufbereitung | White Gloss",
    question: "Welche Aufbereitung passt zum festgestellten Zustand und welche Spuren bleiben?",
    service: "leasingrueckgabe",
    related: ["leasingrueckgabe-checkliste", "lackkorrektur-swirls-kratzer-politur", "innenraumreinigung-komplettguide-auto"],
  },
  "smart-repair-oder-lackkorrektur": {
    title: "Dellenentfernung oder Lackkorrektur? | White Gloss",
    question: "Geht es um eine Verformung des Blechs oder um Spuren im Lack?",
    service: "smart-repair",
    related: ["lackkorrektur-swirls-kratzer-politur", "leasingrueckgabe-aufbereitung-vermeiden-mehrkosten"],
  },
  "fahrzeugaufbereitung-horb-am-neckar": {
    title: "Fahrzeugaufbereitung in Horb am Neckar | White Gloss",
    question: "Wo findet die Aufbereitung statt und welche Pakete stehen zur Wahl?",
    service: "fahrzeugaufbereitung",
    related: ["hol-und-bringservice", "innenraumreinigung-komplettguide-auto", "keramikversiegelung-kosten"],
  },
};

export function articleBookingSelection(slug: string) {
  const guide = articleNavigation[slug];
  return guide ? serviceBookingSelection(guide.service) : {};
}
