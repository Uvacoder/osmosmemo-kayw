import { browser } from "webextension-polyfill-ts";

import { fitTextareaToContent } from "../shared/utils/fit-textarea-to-content";
import { getUserOptions, setUserOptions } from "../shared/utils/user-options";

const optionsForm = document.querySelector(".js-options-form") as HTMLElement;
const connectButtonElement = document.querySelector(".js-connect") as HTMLElement;
const accessTokenElement = document.querySelector(".js-access-token") as HTMLInputElement;
const manifestElement = document.querySelector(".js-manifest") as HTMLElement;
const usernameElement = document.querySelector(".js-username") as HTMLInputElement;
const repoElement = document.querySelector(".js-repo") as HTMLInputElement;
const placeElement = document.querySelector(".js-place") as HTMLInputElement;
const stagingEle = document.querySelector(".js-staging-area") as HTMLDivElement;
const addedTagsElement = document.querySelector(".js-added-tags") as HTMLElement;
const addedFilesElement = document.querySelector(".js-added-files") as HTMLElement;

function renderInputField({ element, string }) {
  element.value = string;
}

async function renderAllFields() {
  const { accessToken, username, repo, place, manifest } = await getUserOptions();

  renderInputField({ element: accessTokenElement, string: accessToken });
  renderInputField({ element: usernameElement, string: username });
  renderInputField({ element: repoElement, string: repo });
  renderInputField({ element: placeElement, string: place });
  renderInputField({ element: manifestElement, string: manifest });

  updateStagingsPreview(manifest);
}

renderAllFields();

addedTagsElement.addEventListener("click", async (e) => {
  const selectedButton = (e.target as HTMLElement).closest("button");
  if (!selectedButton) return;
  const removeIndex = parseInt((selectedButton.dataset as any).index);
  const remainingTags = addedTagsElement.querySelectorAll("button");
  if (remainingTags.length) {
    remainingTags[Math.max(0, removeIndex - 1)].focus()
  }
  //(e.target as HTMLElement).remove()
  const newTagFileOptions = (await browser.storage.local.get({ 'new-tagfiles': { tags: [], files: [] }}))['new-tagfiles'];
  newTagFileOptions.tags.splice(removeIndex, 1)
    addedTagsElement.innerHTML = newTagFileOptions.tags
      .map((tag, index) => `<button class="added-tag" type="button" data-index=${index}>#${tag}</button>`)
      .join("");
  await browser.storage.local.set({ 'new-tagfiles': newTagFileOptions })
});

addedFilesElement.addEventListener("click", async (e) => {
  const selectedButton = (e.target as HTMLElement).closest("button");
  if (!selectedButton) return;
  const removeIndex = parseInt((selectedButton.dataset as any).index);
  const remainings = addedFilesElement.querySelectorAll("button");
  if (remainings.length) {
    remainings[Math.max(0, removeIndex - 1)].focus()
  }
  //(e.target as HTMLElement).remove()
  const newTagFileOptions = (await browser.storage.local.get({ 'new-tagfiles': { tags: [], files: [] }}))['new-tagfiles'];
  newTagFileOptions.files.splice(removeIndex, 1)
    addedFilesElement.innerHTML = newTagFileOptions.files
      .map((filename, index) => `<button class="added-tag" type="button" data-index=${index}>${filename}</button>`)
      .join("");
  await browser.storage.local.set({ 'new-tagfiles': newTagFileOptions })
});

browser.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "sync") {
    renderAllFields();
  }
});

connectButtonElement.addEventListener("click", async (event) => {
  if (!(optionsForm as HTMLFormElement).checkValidity()) return;
  event.preventDefault();

  const accessToken = accessTokenElement.value;
  const username = usernameElement.value;
  const repo = repoElement.value;
  const place = placeElement.value;

  connectButtonElement.innerText = "🔗 Connecting…";

  try {
    connectButtonElement.innerText = "✅ Connected to GitHub";
    setUserOptions({ accessToken, username, repo, place });

    showConditionalElements("on-success");
  } catch (e) {
    connectButtonElement.innerText = "❌ Something went wrong. Try again";
    showConditionalElements("on-error");
  }
});

async function updateStagingsPreview(manifest: string) {
  const workingAreaMap = (await browser.storage.local.get({ 'working-area': {} }))['working-area']
  const newTagFileOptions = (await browser.storage.local.get({ 'new-tagfiles': { tags: [], files: [] }}))['new-tagfiles'];
  Object.keys(workingAreaMap).forEach(filename => {
    const stageFileDiv = document.createElement('div')
    stageFileDiv.innerHTML = `<label for="stagings" class="field__label">${filename}</label>`
    const content = Array.isArray(workingAreaMap[filename]) ? workingAreaMap[filename]: [workingAreaMap[filename]]
    content.forEach((contentStr, idx) => {
      const stageContentDiv = document.createElement('div')
      stageContentDiv.style.margin = "5px"
      stageContentDiv.innerHTML = `
      <div class="staging-textarea field__input js-textarea-fit-container">
        <textarea class="js-staging-textarea field__input" readonly rows="1"></textarea>
        <span class="staging-remove-btn">❌</span>
      </div>`
      stageFileDiv.appendChild(stageContentDiv)
      const textareaElement = stageContentDiv.querySelector('.js-staging-textarea') as HTMLElement
      const removeBtnElement = stageContentDiv.querySelector('.staging-remove-btn') as HTMLElement
      textareaElement.innerText = contentStr
      removeBtnElement.addEventListener('click', async () => {
        stageContentDiv.remove()
        content.splice(idx, 1)
        if (content.length === 0) {
          delete workingAreaMap[filename]
          stageFileDiv.remove()
        } else {
          workingAreaMap[filename] = content
        }
        await browser.storage.local.set({ 'working-area': workingAreaMap })
      })
    })
    stagingEle.appendChild(stageFileDiv)
  })
  if (newTagFileOptions.tags.length) {
    addedTagsElement.innerHTML = newTagFileOptions.tags
      .map((tag, index) => `<button class="added-tag" type="button" data-index=${index}>#${tag}</button>`)
      .join("");
  }
  if (newTagFileOptions.files.length) {
    addedFilesElement.innerHTML = newTagFileOptions.files
      .map((filename, index) => `<button class="added-tag" type="button" data-index=${index}>${filename}</button>`)
      .join("");
  }
  //renderInputField({ element: tagsElement, string: tags.join(", ") });
  //tagCountElement.innerText = `${tags.length} found`;

  //fitTextareaToContent();
}

function showConditionalElements(condition: "on-success" | "on-error") {
  (document.querySelectorAll(`[data-show]`) as NodeListOf<HTMLElement>).forEach((element) => {
    if (element.dataset.show === condition) {
      element.dataset.showActive = "";
    } else {
      delete element.dataset.showActive;
    }
  });
}
