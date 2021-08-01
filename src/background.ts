import { browser } from "webextension-polyfill-ts";

browser.contextMenus.create({
  title: "保存到",
  id: 'osmos-save',
  contexts: ['selection']
});

browser.contextMenus.onClicked.addListener(async (payload) => {
  console.log(payload)
  const menuItemId = String(payload.menuItemId)
  const selectText = payload.selectionText || ''
  switch (menuItemId) {
    case 'osmos-save':
      /*
          chrome.tabs.create({
      url: chrome.extension.getURL('popup.html'),
      active: false
  }, function(tab) {
      // After the tab has been created, open a window to inject the tab
      chrome.windows.create({
          tabId: tab.id,
          type: 'popup',
          focused: true
      });
  });
     */
      const tabs = await browser.tabs.query({ active: true, currentWindow: true})
      if (tabs.length > 0 && tabs[0].id !== null) {
        browser.tabs.sendMessage(tabs[0].id as number, { command: 'EMIT_SELECTION', selectText})
      }
      break;
    default:
      break
  }
})

  browser.runtime.onMessage.addListener(async (request) => {
    if (request.toIframe && (request.command === "metadata-ready" || request.command === "cached-model-ready")) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true})
      if (tabs.length > 0 && tabs[0].id !== null) {
        browser.tabs.sendMessage(tabs[0].id as number, request)
      }
    }
  });
