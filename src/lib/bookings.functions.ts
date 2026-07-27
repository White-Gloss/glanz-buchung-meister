import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calcDeposit,
  calcLineItems,
  calcTotals,
  normalizePlate,
  type Booking,
  type BookingStatus,
} from "./bookings";
import { addOns, servicePackages, taxConfig, vehicleTypes } from "./servicesConfig";

type Row = {
  id: string;
  invoice_number: string;
  created_at: string;
  vehicle_id: string;
  package_id: string;
  add_on_ids: string[] | null;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_plate: string;
  total: number | string;
  status: string;
  is_new_customer: boolean;
  deposit_amount: number | string;
  deposit_status: string;
  access_token: string;
};

function toBooking(row: Row): Booking {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    packageId: row.package_id,
    addOnIds: row.add_on_ids ?? [],
    date: row.booking_date,
    time: row.booking_time,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      plate: row.customer_plate,
    },
    total: Number(row.total),
    status: row.status as BookingStatus,
    isNewCustomer: row.is_new_customer,
    depositAmount: Number(row.deposit_amount),
    depositStatus: row.deposit_status as Booking["depositStatus"],
    accessToken: row.access_token,
  };
}

const SELECT =
  "id, invoice_number, created_at, vehicle_id, package_id, add_on_ids, booking_date, booking_time, customer_name, customer_email, customer_phone, customer_plate, total, status, is_new_customer, deposit_amount, deposit_status, access_token";

export type BookingInput = {
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  plate: string;
};

function validate(input: BookingInput): BookingInput {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const email = String(input.email ?? "").trim().slice(0, 160);
  const phone = String(input.phone ?? "").trim().slice(0, 40);
  const plate = String(input.plate ?? "").trim().slice(0, 20).toUpperCase();
  const vehicleId = String(input.vehicleId ?? "");
  const packageId = String(input.packageId ?? "");
  const addOnIds = Array.isArray(input.addOnIds) ? input.addOnIds.slice(0, 20).map(String) : [];
  const date = String(input.date ?? "");
  const time = String(input.time ?? "");

  if (!vehicleTypes.some((v) => v.id === vehicleId)) throw new Error("Ungültige Fahrzeugklasse");
  if (!servicePackages.some((p) => p.id === packageId)) throw new Error("Ungültiges Paket");
  if (!addOnIds.every((id) => addOns.some((a) => a.id === id)))
    throw new Error("Ungültige Zusatzleistung");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ungültiges Datum");
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Ungültige Uhrzeit");
  if (name.length < 2) throw new Error("Bitte einen gültigen Namen angeben");
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error("Ungültige E-Mail-Adresse");
  if (phone.length < 6) throw new Error("Ungültige Telefonnummer");
  if (plate.length < 3) throw new Error("Ungültiges Kennzeichen");

  return { vehicleId, packageId, addOnIds, date, time, name, email, phone, plate };
}

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: BookingInput) => validate(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Aktuelle (im Admin-Panel gepflegte) Preise anwenden
    const { data: priceRows } = await supabaseAdmin
      .from("service_prices")
      .select("item_type, item_id, label, amount");
    applyPriceOverrides(
      (priceRows ?? []).map((r: { item_type: string; item_id: string; label: string; amount: number | string }) => ({
        item_type: r.item_type as "package" | "addon" | "vehicle",
        item_id: r.item_id,
        label: r.label,
        amount: Number(r.amount),
      })),
    );

    const totals = calcTotals(
      calcLineItems({
        vehicleId: data.vehicleId,
        packageId: data.packageId,
        addOnIds: data.addOnIds,
      }),
    );


    // Neukunden-Prüfung: E-Mail ODER Kennzeichen noch nie verwendet
    const { data: history, error: histError } = await supabaseAdmin
      .from("bookings")
      .select("customer_email, customer_plate")
      .limit(5000);
    if (histError) throw new Error(histError.message);

    const plate = normalizePlate(data.plate);
    const email = data.email.toLowerCase();
    const isNewCustomer = !(history ?? []).some(
      (r: { customer_email: string; customer_plate: string }) =>
        r.customer_email.toLowerCase() === email || normalizePlate(r.customer_plate) === plate,
    );

    const { count } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true });
    const invoiceNumber = `${taxConfig.invoicePrefix}${taxConfig.invoiceStartNumber + (count ?? 0)}`;

    const depositAmount = calcDeposit(totals.gross, isNewCustomer);

    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        invoice_number: invoiceNumber,
        vehicle_id: data.vehicleId,
        package_id: data.packageId,
        add_on_ids: data.addOnIds,
        booking_date: data.date,
        booking_time: data.time,
        customer_name: data.name,
        customer_email: data.email,
        customer_phone: data.phone,
        customer_plate: data.plate,
        total: totals.gross,
        status: "Angefragt",
        is_new_customer: isNewCustomer,
        deposit_amount: depositAmount,
        deposit_status: depositAmount > 0 ? "offen" : "nicht_erforderlich",
      })
      .select(SELECT)
      .single();

    if (error) throw new Error(error.message);
    return toBooking(row as Row);
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("bookings")
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toBooking);
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: BookingStatus }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return toBooking(row as Row);
  });

export const updateDepositStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; depositStatus: Booking["depositStatus"] }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("bookings")
      .update({ deposit_status: data.depositStatus })
      .eq("id", data.id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return toBooking(row as Row);
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });
