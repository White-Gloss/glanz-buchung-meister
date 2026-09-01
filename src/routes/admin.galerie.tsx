import { createFileRoute } from "@tanstack/react-router";
import { CmsEditor } from "@/components/cms-editor";

export const Route = createFileRoute("/admin/galerie")({
  component: () => (
    <CmsEditor
      kind="gallery"
      kicker="Angebot & Website"
      heading="Fahrzeuggalerie"
      hint="Fotos unter /media/hero.jpg (Atelierfahrzeug), plus Lack, Felgen, Keramik, Leder, Finish, Dellen. Bildtext ehrlich: kein Kundenname, keine Kennzeichen."
      extraLabel="Bildadresse"
    />
  ),
});
