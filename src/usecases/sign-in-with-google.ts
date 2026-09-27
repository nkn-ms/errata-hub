"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGoogle() {
  await startOAuth("google");
}
