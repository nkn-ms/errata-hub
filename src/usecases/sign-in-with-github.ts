"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGitHubUsecase() {
  await startOAuth("github");
}
