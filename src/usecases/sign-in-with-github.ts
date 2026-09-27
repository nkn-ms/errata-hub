"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGitHub() {
  await startOAuth("github");
}
