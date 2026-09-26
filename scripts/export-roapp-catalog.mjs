import { writeFile } from 'node:fs/promises';
import { packages, extras, vehicleClasses, services, pickupPricing } from '../src/data/site.ts';

const entries = [];
for (const klass of vehicleClasses) {
  for (const item of [...packages, ...extras]) {
    const isPackage = packages.some(p => p.id === item.id);
    entries.push({
      key: `${item.id}:${klass.id}`,
      name: `${item.name} – ${klass.label}`,
      category: `White Gloss > ${isPackage ? 'Pakete' : 'Zusatzleistungen'} > ${klass.label.replaceAll('/', '-')}`,
      price: Math.round(item.price * klass.factor * 100) / 100,
      description: `${item.body || item.hint || item.name} Fahrzeugklasse: ${klass.label}; Preisfaktor ${klass.factor}. Einstiegspreis inkl. 19 % MwSt.; verbindlicher Preis erst nach Prüfung und Freigabe. Website-Kennung: ${item.id}:${klass.id}.`,
    });
  }
}
for (const service of services) {
  for (const [index, row] of (service.priceRows || []).entries()) {
    if (service.slug !== 'lederreparatur') continue;
    entries.push({
      key: `repair:${service.slug}:${index}`,
      name: `Reparatur – ${row.name}`,
      category: 'White Gloss > Reparaturen nach Einzelprüfung',
      price: row.price,
      description: `${row.note || ''}. Einstiegspreis inkl. 19 % MwSt.; nach Materialprüfung. Quelle: https://white-gloss.de/leistungen/${service.slug}`,
    });
  }
}
for (const tier of pickupPricing.tiers) {
  entries.push({key:`pickup:${tier.id}`,name:`Hol- und Bringservice – bis ${tier.maxKm} km`,category:'White Gloss > Hol- und Bringservice',price:tier.amount,description:'Preis inkl. 19 % MwSt. gemäß Website. Entfernungsstaffeln sind Alternativen und dürfen nicht addiert werden. Über 50 km auf Anfrage; bei Keramikschutz bis 60 km inklusive.'});
}
entries.push({key:'pickup:keramik',name:'Hol- und Bringservice – Keramikschutz bis 60 km inklusive',category:'White Gloss > Hol- und Bringservice',price:0,description:'Nur in Verbindung mit dem Paket Keramikschutz bis 60 km inklusive. Keine zusätzlichen Abholkosten berechnen.'});
if (new Set(entries.map(x=>x.name)).size !== entries.length) throw new Error('Duplicate catalog title');
await writeFile(process.argv[2] || '../roapp-catalog.json', JSON.stringify(entries,null,2)+'\n');
console.log(`${entries.length} Katalogpositionen aus Website-Daten exportiert.`);
