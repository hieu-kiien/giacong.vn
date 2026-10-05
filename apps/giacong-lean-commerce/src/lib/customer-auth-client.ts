"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { customerLoginDestination } from "./customer-login-destination";

export const customerAuthClient = createAuthClient({
  plugins: [usernameClient({ displayUsername: false })],
});

export function signInWithGoogle(callbackURL = "/tai-khoan") {
  const callback = new URL(callbackURL, "https://website.invalid");
  const next = customerLoginDestination(callback.pathname.startsWith("/tai-khoan") ? callback.searchParams.get("next") : callbackURL);
  return customerAuthClient.signIn.social({
    provider: "google",
    callbackURL,
    errorCallbackURL: `/tai-khoan/dang-nhap/?error=google-sign-in&next=${encodeURIComponent(next)}`,
  });
}
