import { fitTextareaToContent } from "../shared/utils/fit-textarea-to-content";
import { browser } from "webextension-polyfill-ts";

/* Input elements */
const formElement = document.querySelector(".js-creation-form") as HTMLFormElement;
const titleInputElement = document.querySelector(".js-title") as HTMLInputElement;
const linkInputElement = document.querySelector(".js-link") as HTMLInputElement;
const descriptionInputElement = document.querySelector(".js-description") as HTMLInputElement;
const previewElement = document.querySelector(".js-preview") as HTMLInputElement;
const fileInputElement = document.querySelector(".js-file-input") as HTMLInputElement;
const fileOptionsElement = document.querySelector(".js-file-options") as HTMLDataListElement;
const addedTagsElement = document.querySelector(".added-tags") as HTMLElement;
const tagInputElement = document.querySelector(".js-tag-input") as HTMLInputElement;
const tagOptionsElement = document.querySelector(".js-tag-options") as HTMLDataListElement;
const addTagButtonElement = document.querySelector(".js-add-tag-button") as HTMLButtonElement;
const actionsElement = document.querySelector(".js-actions") as HTMLDivElement;
const stageButtonElement = document.querySelector(".js-stage") as HTMLButtonElement;
const saveButtonElement = document.querySelector(".js-save") as HTMLButtonElement;
const openOptionsButtonElement = document.querySelector(".js-open-options") as HTMLButtonElement;

const saveStatusDisplayStrings = new Map([
  ["new", "💾 Save"],
  ["saving", "💾 Saving…"],
  ["saved", "✅ Saved"],
  ["error", "❌ Error"],
]);

export class View {
  constructor() {
    // fix me: chromium edge seems to be flaky with autosize
    fitTextareaToContent();
  }

  validateForm() {
    return formElement.checkValidity();
  }

  handleOutput({ onTitleChange, onLinkChange, onDescriptionChange,  onFilenameChange, onAddTag, onRemoveTagByIndex, onStage, onSave }) {
    saveButtonElement.addEventListener("click", (event) => {
      event.preventDefault(); // don't reload page

      onSave();
    });
    stageButtonElement.addEventListener('click', async (ev) => {
      ev.preventDefault();

      // commit any tag left in the input
      this.commitTag({ onAddTag });
      const res = await onStage()
      if (res === 'fail') {
        stageButtonElement.innerText = "❗Stage"
      } else if (res === 'success') {
        stageButtonElement.innerText = "✅Staged"
      } else if (res === 'error') {
        stageButtonElement.innerText = "🚫Stage"
      }
    })

    titleInputElement.addEventListener("input", (e) => onTitleChange((e.target as HTMLInputElement).value));
    linkInputElement.addEventListener("input", (e) => onLinkChange((e.target as HTMLInputElement).value));
    descriptionInputElement.addEventListener("input", (e) => onDescriptionChange((e.target as HTMLInputElement).value));
    fileInputElement.addEventListener("blur", (ev) => onFilenameChange((ev.target as HTMLInputElement).value));
    addTagButtonElement.addEventListener("click", () => this.commitTag({ onAddTag, refocus: true }));
    tagInputElement.addEventListener("keydown", (e) => {
      if (e.isComposing) {
        // passthrough IME events
        return;
      }

      if (e.key === "Enter") {
        // prevent form submission
        e.preventDefault();
      }

      if (tagInputElement.value !== "" && e.key === "Enter") {
        this.commitTag({ onAddTag });
      }
      if (tagInputElement.value === "" && e.key === "Backspace") {
        this.tryFocusLastTag();
      }
    });

    addedTagsElement.addEventListener("click", (e) => {
      const selectedButton = (e.target as HTMLElement).closest("button");
      if (!selectedButton) return;
      const removeIndex = parseInt(((e.target as HTMLElement).closest("button")!.dataset as any).index);
      this.removeTagAtIndex(removeIndex, onRemoveTagByIndex);
    });
    addedTagsElement.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        const removeIndex = parseInt(((e.target as HTMLElement).closest("button")!.dataset as any).index);
        this.removeTagAtIndex(removeIndex, onRemoveTagByIndex);
      }
    });
    previewElement.addEventListener("focus", () => previewElement.select());
    previewElement.addEventListener("click", () => previewElement.select());

    openOptionsButtonElement.addEventListener("click", () => browser.runtime.openOptionsPage());
  }

  render({ state, previousState }) {
    const { title, href, description, tags, tagOptions, fileOptions, saveStatus, connectionStatus, libraryUrl } = state;

    if (title !== previousState.title) {
      titleInputElement.value = title;
    }

    if (href !== previousState.href) {
      linkInputElement.value = href;
    }

    if (description !== previousState.description) {
      descriptionInputElement.value = description;
    }

    if (tags.join("") !== previousState.tags.join("")) {
      addedTagsElement.innerHTML = tags
        .map((tag, index) => `<button class="added-tag" type="button" data-index=${index}>#${tag}</button>`)
        .join("");
    }

    if (fileOptions.join("") !== previousState.fileOptions.join("")) {
      fileOptionsElement.innerHTML = fileOptions.map((option) => `<option value=${option}></option>`).join("");
    }
    if (tagOptions.join("") !== previousState.tagOptions.join("")) {
      tagOptionsElement.innerHTML = tagOptions.map((option) => `<option value=${option}></option>`).join("");
    }

    const newOutputPreview = this.getPreviewOutput(title, href, description, tags);
    if (previewElement.innerText !== newOutputPreview) {
      previewElement.innerText = newOutputPreview;
    }

    if (saveStatus !== previousState.saveStatus) {
      saveButtonElement.innerText = saveStatusDisplayStrings.get(saveStatus)!;
    }


    if (connectionStatus !== previousState.connectionStatus) {
      const isError = connectionStatus === "error";
      if (isError) {
        saveButtonElement.hidden = true;
      }
      actionsElement.classList.toggle("has-error", isError);
      openOptionsButtonElement.classList.toggle("has-error", isError);
    }

    fitTextareaToContent();
  }

  removeTagAtIndex(index, onRemoveTagByIndex) {
    onRemoveTagByIndex(index);
    const remainingTags = addedTagsElement.querySelectorAll("button");
    const elementToFocus = remainingTags.length ? remainingTags[Math.max(0, index - 1)] : tagInputElement;
    elementToFocus.focus();
  }

  tryFocusLastTag() {
    const remainingTags = addedTagsElement.querySelectorAll("button");
    if (remainingTags.length) {
      remainingTags[remainingTags.length - 1].focus();
    }
  }

  getPreviewOutput(title, href, description, tags) {
    if (!title || !href) {
      return ""
    }
    const titleLink = `- [${title}](${href})`;
    const outputArray = [titleLink];

    if (tags.length) {
      outputArray.push(tags.map((tag) => `#${tag}`).join(" "));
    }

    if (description) {
      outputArray.push('\n > ' + description);
    }

    return outputArray.join(" ");
  }

  commitTag(input: { onAddTag: (value: string) => any; refocus?: boolean }) {
    const { onAddTag, refocus } = input;
    const sanitizedValue = this.getSanitizedTagInput();
    if (sanitizedValue !== "") {
      onAddTag(sanitizedValue);
    }

    tagInputElement.value = "";

    if (refocus) {
      tagInputElement.focus();
    }
  }

  getSanitizedTagInput() {
    return tagInputElement.value
      .toLocaleLowerCase()
      .trim()
      .replace(/[\s-_]+/g, "-") /* Standardize joiner to - */
      .replace(/#/g, ""); /* Prevent duplicated tag symbol */
  }
}
