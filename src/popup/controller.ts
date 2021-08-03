import { browser } from "webextension-polyfill-ts";
import { getContentString, getLibraryUrl, insertContent } from "../shared/github/rest-api";
//import { getUniqueTagsFromMarkdownString } from "../shared/utils/tags";
import { getUserOptions } from "../shared/utils/user-options";
import type { CacheableModel, Model, FullModel } from "./model";
import type { View } from "./view";

export class Controller {
  constructor(private model: Model, private view: View) {
    this.init();
  }

  async init() {
    this.view.handleOutput({
      onTitleChange: (title) => this.model.updateAndCache({ title }),
      onLinkChange: (href) => this.model.updateAndCache({ href }),
      onDescriptionChange: (description) => this.model.updateAndCache({ description }),
      onFilenameChange: (filename)=> {
        this.model.updateAndCache({ filename })
        this.model.updateNewFileOption(filename)
      },
      onAddTag: (tag) => {
        this.model.updateAndCache({ tags: [...this.model.state.tags, tag] })
        this.model.updateNewTagOption(tag)
      },
      onRemoveTagByIndex: (index) =>
        this.model.updateAndCache({ tags: this.model.state.tags.filter((_, i) => i !== index) }),
      onSave: () => this.onSave(),
    });

    this.model.emitter.addEventListener("update", (e) => {
      const { state, previousState, shouldCache } = (e as CustomEvent).detail;
      this.view.render({ state, previousState });
      if (shouldCache) {
        this.cacheModel();
      }
    });

    const optionsData = await getUserOptions();

    const { accessToken, username, repo, filename } = optionsData;
    this.model.update({ tagOptions: ['wiki', 'noteui', 'devops', 'kubernetes'], fileOptions: ['wiki/webapp/react.md', 'wiki/go-nimrod.md', 'snippets/golang/sorter.go'] });
    try {
      const wikiMetaJson= await getContentString({ accessToken, username, repo, filename: 'wiki.json'});
      const libraryUrl = await getLibraryUrl({ accessToken, username, repo, filename });
      const { tags: tagOptions, files: fileOptions} = JSON.parse(wikiMetaJson)
      this.model.update({ tagOptions, fileOptions, libraryUrl, connectionStatus: "valid" });
      console.log(`[controller] tags available`, tagOptions.length);
    } catch (e) {
      this.model.update({ connectionStatus: "error" });
    }
  }

  async onSave() {
    if (!this.view.validateForm()) {
      return;
    }

    this.model.update({ saveStatus: "saving" });
    const optionsData = await getUserOptions();
    try {
      const { accessToken, username, repo } = optionsData;
      const { title, href, description, tags, filename } = this.model.state;
      const newEntryString = this.view.getPreviewOutput(title, href, description, tags);
      await insertContent({ accessToken, username, repo, filename, content: newEntryString });
      this.model.update({ saveStatus: "saved" });
    } catch {
      this.model.update({ saveStatus: "error" });
    }
  }

  onData({ title, href, description='', cacheKey }: Partial<FullModel>) {
    this.model.update({ title, description, href, cacheKey, saveStatus: "new" });
  }

  onCache(cachedModel: CacheableModel) {
    this.model.update(cachedModel);
  }

  async cacheModel() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs?.[0]?.id) {
      console.error(`[controller] cannot cache model. Activie tab does not exist.`);
      return;
    }

    browser.tabs.sendMessage(tabs[0].id, { command: "set-cached-model", data: this.model.getCacheableState() });
  }
}
