import frappe
from frappe import _
from frappe.model.document import Document


APPROVED_SERVICE_CODES = {
    "WG-PKG-BASIS",
    "WG-PKG-PREMIUM",
    "WG-PKG-KERAMIK",
    "WG-ADD-FELGEN",
    "WG-ADD-LEDER",
    "WG-ADD-MOTOR",
    "WG-ADD-OZON",
    "WG-ADD-SCHEINWERFER",
    "WG-ADD-HOLBRING",
    "WG-PICKUP-10KM",
    "WG-PICKUP-20KM",
    "WG-PICKUP-50KM",
}

ALLOWED_TRANSITIONS = {
    "Neue Buchung": {"Prüfung", "Storniert"},
    "Prüfung": {"Bestätigt", "Storniert"},
    "Bestätigt": {"Fahrzeug angenommen", "Storniert"},
    "Fahrzeug angenommen": {"In Arbeit", "Storniert"},
    "In Arbeit": {"Qualitätskontrolle"},
    "Qualitätskontrolle": {"In Arbeit", "Fertig"},
    "Fertig": {"Rechnung"},
    "Rechnung": {"Bezahlt"},
    "Bezahlt": {"Abgeschlossen"},
    "Abgeschlossen": set(),
    "Storniert": set(),
}


class WHITEGLOSSOrder(Document):
    def validate(self):
        self.booking_id = (self.booking_id or "").strip()
        if not self.booking_id:
            frappe.throw(_("Booking ID is required."))

        self._validate_vehicle_customer()
        self._validate_services()
        self._validate_status_transition()
        self._validate_date_only_semantics()

    def _validate_vehicle_customer(self):
        vehicle_customer = frappe.db.get_value("WHITE GLOSS Vehicle", self.vehicle, "customer")
        if vehicle_customer and vehicle_customer != self.customer:
            frappe.throw(_("The selected vehicle belongs to a different customer."))

    def _validate_services(self):
        if not self.services:
            frappe.throw(_("At least one service is required."))

        for row in self.services:
            if row.item not in APPROVED_SERVICE_CODES:
                frappe.throw(_("Service item {0} is not in the approved WHITE GLOSS catalog.").format(row.item))
            if row.item_code_snapshot != row.item:
                frappe.throw(_("Service item snapshot must exactly match the Item code."))
            if not row.item_name_snapshot:
                frappe.throw(_("Service item name snapshot is required."))
            if not row.qty or row.qty <= 0:
                frappe.throw(_("Service quantity must be greater than zero."))

    def _validate_status_transition(self):
        previous = self.get_doc_before_save()
        if not previous or previous.status == self.status:
            return

        allowed = ALLOWED_TRANSITIONS.get(previous.status, set())
        if self.status not in allowed:
            frappe.throw(
                _("Status transition from {0} to {1} is not allowed.").format(previous.status, self.status)
            )

    def _validate_date_only_semantics(self):
        if self.date_only and self.handover_time:
            frappe.throw(_("Handover Time must stay empty while Date Only is enabled."))
