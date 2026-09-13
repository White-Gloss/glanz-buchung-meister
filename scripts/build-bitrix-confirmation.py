"""Build native Bitrix templates using the owner's September 2026 invoice layout.
No customer data, bank details, invoice number or payment status from the sample
is embedded. All transactional values must be supplied by the verified workflow.
"""
from pathlib import Path
import io
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root = Path(__file__).resolve().parents[1]
logo = (root / 'docs/bitrix/templates/white-gloss-logo.png').read_bytes()

def shade(cell, fill):
    node = OxmlElement('w:shd'); node.set(qn('w:fill'), fill)
    cell._tc.get_or_add_tcPr().append(node)

def borderless(table):
    borders = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        e=OxmlElement('w:'+side);e.set(qn('w:val'),'nil');borders.append(e)
    table._tbl.tblPr.append(borders)

def build(invoice=False):
    doc=Document()
    for border in list(doc.styles.element.xpath('.//w:pBdr')):
        border.getparent().remove(border)
    section=doc.sections[0]
    section.page_width,section.page_height=Inches(8.27),Inches(11.69)
    section.top_margin=Inches(.7);section.bottom_margin=Inches(.8)
    section.left_margin=section.right_margin=Inches(.8)
    normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(9)
    normal.paragraph_format.space_after=Pt(6)
    for name in ['Title','Heading 1','Heading 2']:
        doc.styles[name].font.name='Arial'
        doc.styles[name].font.color.rgb=RGBColor(0,0,0)
    doc.styles['Title'].font.size=Pt(20)
    title='Rechnung' if invoice else 'Buchungsbestätigung'
    head=doc.add_table(rows=1,cols=3);head.autofit=False
    for col,width in zip(head.columns,[4.7,.35,1.55]):col.width=Inches(width)
    for cell,width in zip(head.rows[0].cells,[4.7,.35,1.55]):cell.width=Inches(width)
    borderless(head)
    head.cell(0,0).paragraphs[0].style=doc.styles['Title']
    head.cell(0,0).paragraphs[0].add_run(title)
    p=head.cell(0,2).paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(io.BytesIO(logo),width=Inches(1.4))
    p=doc.add_paragraph();p.paragraph_format.space_after=Pt(24)
    p=doc.add_paragraph('White-Gloss Detailing - Lars Marco Hägele · Arnistal 27 · 72160 Horb (Dettingen)')
    p.runs[0].font.size=Pt(7)
    addresses=doc.add_table(rows=1,cols=2);borderless(addresses)
    addresses.cell(0,0).text='{WGCustomerName}\n{WGCustomerAddress}'
    addresses.cell(0,1).text=('Rechnungsnummer: {WGInvoiceNumber}' if invoice else 'Buchungsreferenz: {WGReference}')+'\nAusgestellt am: {WGIssuedOn}'
    if invoice:addresses.cell(0,1).add_paragraph('Buchungsreferenz: {WGReference}\nLeistungsdatum: {WGServiceDate}')
    else:addresses.cell(0,0).add_paragraph('{WGCustomerEmail}\n{WGCustomerPhone}')
    doc.add_paragraph()
    doc.add_paragraph('Vielen Dank für deinen Auftrag. Wir berechnen die folgenden ausgeführten Leistungen:' if invoice else 'Vielen Dank für deine Buchung. Nach unserer Prüfung bestätigen wir die folgenden Leistungen und den vereinbarten Termin:')
    doc.add_paragraph('Fahrzeug: {WGVehicle} · Kennzeichen: {WGPlate}')
    table=doc.add_table(rows=2,cols=5)
    table.autofit=False
    for col,width in zip(table.columns,[3.05,.65,1.0,.7,1.2]):col.width=Inches(width)
    for row in table.rows:
        for cell,width in zip(row.cells,[3.05,.65,1.0,.7,1.2]):cell.width=Inches(width)
    table.style='Table Grid'
    borderless(table)
    headers=['Beschreibung','Menge','Einzelpreis','MwSt.','Nettobetrag']
    values=['{WGServiceLines}','{Qty}','{UnitNet}','19 %','{LineNet}']
    for i,(label,value) in enumerate(zip(headers,values)):
        table.cell(0,i).text=label;shade(table.cell(0,i),'202020')
        for run in table.cell(0,i).paragraphs[0].runs:run.font.color.rgb=RGBColor(255,255,255);run.bold=True
        table.cell(1,i).text=value
    for label,field in [('Nettobetrag','WGNetTotal'),('MwSt. 19 %','WGVatTotal'),('Gesamtbetrag inkl. MwSt.','WGGrossTotal')]:
        p=doc.add_paragraph(f'{label}: {{{field}}}');p.alignment=WD_ALIGN_PARAGRAPH.RIGHT
        if field=='WGGrossTotal':
            p.runs[0].bold=True
            p.paragraph_format.left_indent=Inches(3.0)
            fill=OxmlElement('w:shd');fill.set(qn('w:fill'),'F3F3F3')
            p._p.get_or_add_pPr().append(fill)
    if invoice:
        doc.add_paragraph('{WGPaymentText}')
        doc.add_paragraph('Verwendungszweck: {WGPaymentReference}')
        doc.add_paragraph('{WGTaxIdentification}')
    else:
        doc.add_paragraph('Beginn: {WGStart}\nEnde: {WGEnd}\nVereinbarte Dauer: {WGDuration}\nLeistungsort: {WGLocation}')
    doc.add_paragraph('Hinweise: {WGNotes}')
    doc.add_paragraph('Vielen Dank für die gute Zusammenarbeit.\nWhite-Gloss Detailing')
    if not invoice:
        doc.add_paragraph('Diese Buchungsbestätigung ist keine Rechnung. Die Rechnung wird nach der Durchführung der Dienstleistung separat erstellt.')
    footer=section.footer
    f=footer.add_table(rows=1,cols=2,width=Inches(6.6));borderless(f)
    f.cell(0,0).text='White-Gloss Detailing - Lars Marco Hägele\nArnistal 27 · 72160 Horb (Dettingen), DE\nbuchung@white-gloss.de'
    f.cell(0,1).text=('{WGBankName}\nIBAN {WGIban}\nBIC {WGBic}' if invoice else 'white-gloss.de\nBuchungsreferenz {WGReference}')
    for cell in f.rows[0].cells:
        for p in cell.paragraphs:
            for run in p.runs:run.font.size=Pt(7)
    name='rechnung' if invoice else 'buchungsbestaetigung'
    path=root/f'docs/bitrix/templates/{name}.docx';doc.save(path);print(path)

build()
build(invoice=True)
