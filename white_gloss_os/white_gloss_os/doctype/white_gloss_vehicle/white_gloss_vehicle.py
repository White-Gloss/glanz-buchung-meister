import re

import frappe
from frappe.model.document import Document


class WHITEGLOSSVehicle(Document):
    def validate(self):
        self.external_reference = (self.external_reference or "").strip()
        if not self.external_reference:
            frappe.throw("External Reference is required.")

        if self.registration_plate:
            normalized = re.sub(r"[^A-Z0-9]", "", self.registration_plate.upper())
            self.registration_plate_normalized = normalized or None
        else:
            self.registration_plate_normalized = None

        if self.vin:
            self.vin = re.sub(r"\s+", "", self.vin.upper())

        if self.model_year and (self.model_year < 1886 or self.model_year > 2200):
            frappe.throw("Model Year is outside the allowed range.")
