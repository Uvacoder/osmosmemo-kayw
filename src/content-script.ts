import { browser } from "webextension-polyfill-ts";
import type { CacheableModel } from "./popup/model";

declare global {
  interface Window {
    _osmosmemoInjected?: boolean;
  }
}

const SKIP_CANONICAL_HOSTNAMES = ["www.youtube.com"];

let iframeEle: HTMLIFrameElement
let selectionText: string

function injectContentScript() {
  // make sure the content script is injected only on first run
  if (window._osmosmemoInjected) return;
  window._osmosmemoInjected = true;

  console.log(`[osmos] content-script activated`);

  browser.runtime.onMessage.addListener((request, sender) => {
    if (request.command === "set-cached-model") {
      console.log(`[osmos] set cached model`, request.data);
      sessionStorage.setItem("cached-model", JSON.stringify(request.data));
    } else if (request.command === "get-model") {
      try {
        const cachedModelString = sessionStorage.getItem("cached-model");
        if (!cachedModelString) throw new Error("No cache model found");
        const cachedModel: CacheableModel = JSON.parse(cachedModelString);

        if (cachedModel.cacheKey !== getPageCacheKey()) {
          throw new Error("Cache invalidated due to key change");
        }

        console.log(`[osmos] get cached model`, cachedModel);
        browser.runtime.sendMessage({ command: "cached-model-ready", data: cachedModel, toIframe: !!iframeEle });
      } catch (e) {
        const model = getMetadata();
        browser.runtime.sendMessage({ command: "metadata-ready", data: model, toIframe: !!iframeEle  });
        console.log(`[osmos] get metadata`, model);
      }
    } else if (request.command === 'EMIT_SELECTION') {
      selectionText = request.selectText
      iframeEle = document.createElement('iframe')
      iframeEle.id = 'osmos-popup-iframe'
      iframeEle.src = browser.extension.getURL('popup.html')
      iframeEle.style.position = 'fixed'
      iframeEle.style.display = 'block'
      iframeEle.style.border = "none"
      iframeEle.style.margin  = "0px"
      iframeEle.style['z-index'] = "2147483647"
      iframeEle.style['background-color'] = "transparent"
      iframeEle.addEventListener('load', (ev) => {
        iframeEle.focus()
        iframeEle.style.width = '420px'
        iframeEle.style.height = '560px'
        const selection = window.getSelection()
        if (selection) {
          const rect = selection.getRangeAt(0).getBoundingClientRect()
          if (rect.right + 420 > window.innerWidth) {
            iframeEle.style.right = '0px'
          } else {
            iframeEle.style.left = rect.right+ "px"
          }
          if (rect.top + 560 > window.innerHeight) {
            iframeEle.style.bottom = "0px"
          } else {
            iframeEle.style.top = rect.top + "px"
          }
        }
      })
      document.body.parentElement?.appendChild(iframeEle)
    }
  });
  window.addEventListener('mousedown', () => {
    if (selectionText && iframeEle) {
      iframeEle.remove()
      iframeEle = null
      selectionText = null
    }
  })

  function getMetadata(): CacheableModel {
    const href = getPageUrl();
    const title = getPageTitle();
    const cacheKey = getPageCacheKey();

    return {
      title,
      href,
      cacheKey,
      description: selectionText
    };
  }

  function getPageUrl() {
    let url = document.querySelector(`link[rel="canonical"]`)?.getAttribute("href")?.trim();

    /**
     * Some websites incorrectly used canonical url. Fallback to location.href
     */
    const canonicalHostname = new URL(url ?? location.href).hostname;
    if (!url || SKIP_CANONICAL_HOSTNAMES.includes(canonicalHostname)) {
      url = location.href;
    }

    return url;
  }

  function getPageCacheKey() {
    return location.href;
  }

  function getPageTitle() {
    let title = document.querySelector(`meta[property="og:title"]`)?.getAttribute("content")?.trim();

    if (!title) {
      title = document.querySelector(`meta[name="twitter:title"]`)?.getAttribute("content")?.trim();
    }

    if (!title) {
      title = document.querySelector("title")?.innerText?.trim();
    }

    if (!title) {
      title = document.querySelector("h1")?.innerText?.trim();
    }

    if (!title) {
      title = "";
    }

    return title;
  }
}

injectContentScript();
