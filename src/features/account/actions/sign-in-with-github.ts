"use server";

import { startOAuth } from "@/services/auth";

export async function signInWithGitHubAction() {
  await startOAuth("github");
}
