"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGoogleUsecase() {
  await startOAuth("google");
}
