import { browser } from "webextension-polyfill-ts";

export interface UserOptions {
  accessToken: string;
  username: string;
  repo: string;
  filename: string;
}

export async function getUserOptions(): Promise<UserOptions> {
  const options = await browser.storage.sync.get(["accessToken", "username", "repo", "filename"]);

  const { accessToken = "", username = "", repo = "", filename = "README.md" } = options;
  const safeOptions: UserOptions = {
    accessToken,
    username,
    repo,
    filename,
  };

  return safeOptions;
}

export async function setUserOptions(update: Partial<UserOptions>) {
  return browser.storage.sync.set(update);
}
