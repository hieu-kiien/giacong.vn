"use client";
export const WEBSITE_SIGN_OUT_KEY = "giacong.website-sign-out";
export const WEBSITE_SIGN_OUT_EVENT = "giacong:website-sign-out";

export function notifyWebsiteSignOut() {
  try { window.localStorage.setItem(WEBSITE_SIGN_OUT_KEY, crypto.randomUUID()); }
  catch { /* Sign-out still succeeds when storage is unavailable. */ }
  window.dispatchEvent(new Event(WEBSITE_SIGN_OUT_EVENT));
}
