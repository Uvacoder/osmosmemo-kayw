import { browser } from "webextension-polyfill-ts";

export interface UserOptions {
  accessToken: string;
  username: string;
  repo: string;
  place: string;
  manifest: string;
}

export async function getUserOptions(): Promise<UserOptions> {
  const options = await browser.storage.sync.get(["accessToken", "username", "repo", "place", 'manifest']);

  const { accessToken = "", username = "", repo = "", place= "home", manifest="manifest.json" } = options;
  const safeOptions: UserOptions = {
    accessToken,
    username,
    repo,
    place,
    manifest
  };

  return safeOptions;
}

export async function setUserOptions(update: Partial<UserOptions>) {
  return browser.storage.sync.set(update);
}
