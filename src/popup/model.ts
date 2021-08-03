export interface FullModel extends CacheableModel {
  description: string;
  tags: string[];
  tagOptions: string[];
  newTagOptions: string[];
  filename: string;
  fileOptions: string[];
  newFileOptions: string[];
  libraryUrl?: string;
  saveStatus: "new" | "saving" | "saved" | "error";
  connectionStatus: "unknown" | "valid" | "error";
}

export interface CacheableModel {
  filename?: string;
  title?: string;
  href?: string;
  cacheKey?: string;
  description?: string;
  tags?: string[];
}

export class Model {
  get state(): FullModel {
    return this._state;
  }

  private _state: FullModel = {
    title: undefined,
    href: undefined,
    cacheKey: undefined,
    description: "",
    tags: [],
    tagOptions: [],
    newTagOptions: [],
    filename: '',
    fileOptions: [],
    newFileOptions: [],
    libraryUrl: undefined,
    saveStatus: "new", // 'new' | 'saving' | 'saved' | 'error',
    connectionStatus: "unknown", // 'unknown' | 'valid' | 'error'
  };
  emitter = document.createElement("div");

  getCacheableState(): CacheableModel {
    const { title, href, cacheKey, description, filename, tags } = this._state;
    return {
      title,
      href,
      cacheKey,
      description,
      filename,
      tags,
    };
  }

  updateNewTagOption(tag: string) {
    if (!this._state.tagOptions.includes(tag)) {
      this._state.newTagOptions.push(tag)
    }
  }
  updateNewFileOption(filename: string) {
    if (!this._state.fileOptions.includes(filename)) {
      this._state.newFileOptions.push(filename)
    }
  }
  updateAndCache(delta: Partial<FullModel>) {
    this.update(delta, true);
  }

  update(delta: Partial<FullModel>, shouldCache = false) {
    const previousState = { ...this._state };
    this._state = { ...this._state, ...delta };
    this.emitter.dispatchEvent(
      new CustomEvent("update", {
        detail: {
          state: this._state,
          previousState,
          shouldCache,
        },
      })
    );
  }
}
