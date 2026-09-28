import { customerPhotos } from "@/data/customer-photos";

const chapters = [
  { id: "customer-01", title: "Die Reinigung.", copy: "Schaumpflege und Fahrzeugwäsche als erster Einblick in die Aufbereitung." },
  { id: "customer-14", title: "Die Details.", copy: "Mittelkonsole, Bedienelemente und Materialien nach der Innenraumaufbereitung." },
  { id: "customer-09", title: "Das Finish.", copy: "Lackreflexionen, Karosserielinien und Felgen am aufbereiteten Fahrzeug." },
];

export function CustomerProjectStory() {
  return <section className="customer-project mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="project-title">
    <header className="customer-project-heading">
      <div><p className="kicker">Ein Kundenfahrzeug · BMW</p><h2 id="project-title" className="heading-2">Vom ersten Schaum<br />bis zum letzten Detail.</h2></div>
      <p>Einblicke in einen Kundenauftrag. Die Originalaufnahmen zeigen die Reinigung, den Innenraum und das fertige Fahrzeug.</p>
    </header>
    <ol className="customer-project-chapters">
      {chapters.map((chapter, index) => {
        const photo = customerPhotos.find((item) => item.id === chapter.id)!;
        return <li key={chapter.id}>
          <img src={photo.src} srcSet={photo.srcSet} sizes="(min-width: 800px) 30vw, 90vw" width={photo.width} height={photo.height} style={{objectPosition:photo.position}} alt={photo.alt} loading="lazy" decoding="async" />
          <div><span className="kicker">0{index + 1}</span><h3>{chapter.title}</h3><p>{chapter.copy}</p></div>
        </li>;
      })}
    </ol>
  </section>;
}
