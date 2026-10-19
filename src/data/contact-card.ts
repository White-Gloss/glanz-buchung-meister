import { site } from "./site.ts";

/**
 * Public digital business card. Keep its published URL stable: printed QR
 * codes point here. The website and downloadable vCard share these values.
 */
export const contactCard = {
  name: site.legalName,
  owner: site.owner,
  tagline: site.tagline,
  phone: site.phoneHref.replace(/^tel:/, ""),
  phoneDisplay: site.phoneDisplay,
  email: site.email,
  street: site.street,
  postalCode: site.postalCode,
  city: site.city,
  country: site.country,
  website: `${site.origin}/`,
  whatsapp: site.whatsappHref,
  instagram: site.instagram,
  instagramHandle: site.instagramHandle,
  // Add only the Facebook profile URL confirmed by Lars. Until then it is
  // absent from both the public page and the contact download.
  facebook: null as string | null,
  cardUrl: `${site.origin}/visitenkarte.html`,
};
