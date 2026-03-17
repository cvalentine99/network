import type { CookieOptions, Request } from "express";

/**
 * Session cookie configuration.
 *
 * Rec 1: Changed sameSite from "none" to "lax".
 * - "none" requires Secure flag and allows cross-site requests (CSRF risk)
 * - "lax" prevents CSRF on POST while allowing top-level navigations
 * - For a same-origin dashboard app, "lax" is the correct default
 */

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
