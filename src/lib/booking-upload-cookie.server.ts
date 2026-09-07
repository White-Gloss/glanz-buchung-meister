import { getCookie, getRequestProtocol, setCookie } from "@tanstack/react-start/server";
import {
  UPLOAD_CAPABILITY_TTL_SECONDS,
  uploadCapabilityCookieName,
  type UploadCapability,
} from "./booking-upload-capability.ts";

/** Request-bound cookie access must remain out of the browser bundle. */
export function setBookingUploadCookie(bookingId: number, capability: UploadCapability): void {
  const secure = getRequestProtocol() === "https";
  setCookie(uploadCapabilityCookieName(bookingId, secure), capability.token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: UPLOAD_CAPABILITY_TTL_SECONDS,
    expires: new Date(capability.expiresAt),
  });
}

export function getBookingUploadCookie(bookingId: number): string | undefined {
  const secure = getRequestProtocol() === "https";
  return getCookie(uploadCapabilityCookieName(bookingId, secure));
}
