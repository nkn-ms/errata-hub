"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGoogleAction() {
  await startOAuth("google");
}
