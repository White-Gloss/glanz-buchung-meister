export const VEHICLE_ORDER_WRITE_CONFIRMATION_PREFIX = "CREATE_WHITE_GLOSS_VEHICLE_ORDER_V2";

type GateStatusInput = {
  enabledValue?: string | null;
  approvedBookingId?: string | null;
  bookingId: string;
};

type GateEvaluationInput = GateStatusInput & {
  bookingRevision: string;
  confirmation?: unknown;
};

export type VehicleOrderWriteGateStatus = {
  enabled: boolean;
  bookingApproved: boolean;
  ready: boolean;
};

export type VehicleOrderWriteGateEvaluation = VehicleOrderWriteGateStatus & {
  confirmationValid: boolean;
  error:
    | "production_write_gate_disabled"
    | "production_write_booking_not_approved"
    | "explicit_write_confirmation_required"
    | null;
};

const normalize = (value?: string | null) => value?.trim() ?? "";

export const buildVehicleOrderWriteConfirmation = (bookingId: string, bookingRevision: string) =>
  `${VEHICLE_ORDER_WRITE_CONFIRMATION_PREFIX}:${bookingId}:${bookingRevision}`;

export function getVehicleOrderWriteGateStatus({
  enabledValue,
  approvedBookingId,
  bookingId,
}: GateStatusInput): VehicleOrderWriteGateStatus {
  const enabled = normalize(enabledValue).toLowerCase() === "true";
  const bookingApproved =
    normalize(approvedBookingId).length > 0 && normalize(approvedBookingId) === bookingId;

  return {
    enabled,
    bookingApproved,
    ready: enabled && bookingApproved,
  };
}

export function evaluateVehicleOrderWriteGate({
  bookingRevision,
  confirmation,
  ...statusInput
}: GateEvaluationInput): VehicleOrderWriteGateEvaluation {
  const status = getVehicleOrderWriteGateStatus(statusInput);
  const confirmationValid =
    normalize(bookingRevision).length > 0 &&
    confirmation === buildVehicleOrderWriteConfirmation(statusInput.bookingId, bookingRevision);
  const evaluation = {
    ...status,
    ready: status.ready && confirmationValid,
    confirmationValid,
  };

  if (!status.enabled) {
    return { ...evaluation, error: "production_write_gate_disabled" };
  }
  if (!status.bookingApproved) {
    return {
      ...evaluation,
      error: "production_write_booking_not_approved",
    };
  }
  if (!confirmationValid) {
    return {
      ...evaluation,
      error: "explicit_write_confirmation_required",
    };
  }

  return { ...evaluation, error: null };
}
