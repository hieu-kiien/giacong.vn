"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const customerAuthClient = createAuthClient({
  plugins: [usernameClient({ displayUsername: false })],
});

export function signInWithGoogle(callbackURL = "/tai-khoan") {
  return customerAuthClient.signIn.social({
    provider: "google",
    callbackURL,
  });
}
