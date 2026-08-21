import frappe


INTEGRATION_ROLE = "WHITE GLOSS Integration"


def after_install():
    """Ensure the least-privilege integration role exists without assigning it."""
    if frappe.db.exists("Role", INTEGRATION_ROLE):
        return

    frappe.get_doc(
        {
            "doctype": "Role",
            "role_name": INTEGRATION_ROLE,
            "desk_access": 0,
            "is_custom": 1,
        }
    ).insert(ignore_permissions=True)
