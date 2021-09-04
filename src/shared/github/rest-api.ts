import { b64DecodeUnicode, b64EncodeUnicode } from "../utils/base64.js";

export async function getContentString({ accessToken, username, repo, filename }) {
  const contents = await getContentsOrCreateNew({ accessToken, username, repo, filename });
  const stringResult = b64DecodeUnicode(contents.content ?? "");

  return stringResult;
}

/** insert content at the first line of the file. An EOL character will be automatically added. */
export async function getMergedContent({ accessToken, username, repo, filename, content }) {
  const contents = await getContents({ accessToken, username, repo, filename });
  const previousContent = b64DecodeUnicode(contents.content ?? "");
  const resultContent = `${content}\n${previousContent}`;
  return resultContent
  //writeContent({ accessToken, username, repo, filename, previousSha: contents.sha, content: resultContent });
}

export async function getMergedJson({ accessToken, username, repo, newTagFileOptions, filename }) {
  const contents = await getContents({ accessToken, username, repo, filename });
  const tagFiles = contents.content ? JSON.parse(b64DecodeUnicode(contents.content)) : {};
  tagFiles.tags = tagFiles.tags.concat(newTagFileOptions.tags)
  tagFiles.files = tagFiles.files.concat(newTagFileOptions.files)
  return JSON.stringify(tagFiles, null, 4)
  //writeContent({ accessToken, username, repo, filename: 'wiki.json', previousSha: contents.sha, content: JSON.stringify(tagFiles)});
}

// https://gist.github.com/StephanHoyer/91d8175507fcae8fb31a
export async function insertMultipleFiles({ accessToken, username, repo, files, message })  {
  const branch = 'master'
  const sha = await fetchHead({ accessToken , username, repo, branch })
  const tree = await fetchTree({ accessToken , username, repo, sha })
  const blobs = await Promise.all(files.map((file) => createBlob({ accessToken, username, repo, content: file.content })))

  const newTree = await createTree({
    accessToken, username, repo,
    tree: files.map((file, index) => {
      return {
        path: file.path,
        mode: '100755',
        type: 'blob',
        sha: blobs[index].sha
      };
    }),
    basetree: tree?.sha
  })

  const commit = await createCommit({
    accessToken,
    username,
    repo,
    message,
    tree: newTree.sha,
    parents: [
      sha
    ]
  })
  await updateHeadCommit({
    accessToken,
    username,
    repo,
    branch,
    sha: commit.sha
  })
}

/** currently only work with public repos */
export async function getLibraryUrl({ accessToken, username, repo, filename }) {
  const defaultBranch = await getDefaultBranch({ accessToken, username, repo });

  return `https://github.com/login?return_to=${encodeURIComponent(
    `https://github.com/${username}/${repo}/blob/${defaultBranch}/${filename}`
  )}`;
}

async function fetchHead({ username, repo, accessToken, branch } ) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/ref/heads/${branch}`, {
      headers: new Headers({
      Authorization: "Basic " + btoa(`${username}:${accessToken}`),
      "Content-Type": "application/json",
    }),
    });

    const branchRef = (await response.json()) as {
      object: {
        type: string
        sha: string
        url: string
      }
    };
    return branchRef.object.sha
  } catch (error) {
    return null;
  }
}

async function fetchTree({ username, repo, accessToken, sha}) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees/${sha}`, {
      headers: new Headers({
      Authorization: "Basic " + btoa(`${username}:${accessToken}`),
      "Content-Type": "application/json",
    }),
    });

    const tree = (await response.json()) as {
      sha: string
    };
    return tree
  } catch (error) {
    return null;
  }
}

async function createBlob({ accessToken, username, repo, content }) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/blobs`, {
      method: "POST",
      headers: new Headers({
        Authorization: "Basic " + btoa(`${username}:${accessToken}`),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        content,
      }),
    });
    const blob = (await response.json()) as { url: string; sha: string };
    return blob
  } catch (error) {
    return null
  }
}

async function createTree({ accessToken, username, repo, tree, basetree }) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/trees`, {
      method: "POST",
      headers: new Headers({
        Authorization: "Basic " + btoa(`${username}:${accessToken}`),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        tree,
        base_tree: basetree,
      }),
    });
    const rtree = (await response.json()) as { url: string; sha: string };
    return rtree
  } catch (error) {
    return null
  }
}

async function createCommit({ accessToken, username, repo, tree, message, parents }) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/commits`, {
      method: "POST",
      headers: new Headers({
        Authorization: "Basic " + btoa(`${username}:${accessToken}`),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        message,
        tree,
        parents
      }),
    });
    const commit = (await response.json()) as { url: string; sha: string };
    return commit
  } catch (error) {
    return null
  }
}

async function updateHeadCommit({ accessToken, username, repo, branch, sha }) {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: new Headers({
        Authorization: "Basic " + btoa(`${username}:${accessToken}`),
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        sha
      })
    });
  } catch (error) {
    return null;
  }
}

async function writeContent({ accessToken, username, repo, filename, previousSha, content }) {
  return fetch(`https://api.github.com/repos/${username}/${repo}/contents/${filename}`, {
    method: "PUT",
    headers: new Headers({
      Authorization: "Basic " + btoa(`${username}:${accessToken}`),
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      message: "New summary added by osmos::memo",
      content: b64EncodeUnicode(content),
      sha: previousSha,
    }),
  });
}

async function getContentsOrCreateNew({ accessToken, username, repo, filename }) {
  let response = await getContentsInternal({ accessToken, username, repo, filename });

  if (response.status === 404) {
    console.log(`[rest-api] ${filename} does not exist. Create new`);
    response = await writeContent({ accessToken, username, repo, filename, previousSha: undefined, content: "" });
  }

  if (!response.ok) throw new Error("create-contents-failed");

  return getContents({ accessToken, username, repo, filename });
}

async function getContents({ accessToken, username, repo, filename }) {
  const response = await getContentsInternal({ accessToken, username, repo, filename });
  if (!response.ok) throw new Error("get-contents-failed");

  return response.json();
}

async function getDefaultBranch({ accessToken, username, repo }): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${username}/${repo}/branches`, {
      headers: new Headers({
        Authorization: "Basic " + btoa(`${username}:${accessToken}`),
        "Content-Type": "application/json",
      }),
    });

    const branches = (await response.json()) as any[];
    if (branches?.length) {
      return branches[0].name as string;
    }
    throw new Error("No branch found");
  } catch (error) {
    return null;
  }
}

async function getContentsInternal({ accessToken, username, repo, filename }) {
  if (!accessToken || !username || !repo || !filename) {
    throw new Error('github client invalid.')
  }
  return await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${filename}`, {
    headers: new Headers({
      Authorization: "Basic " + btoa(`${username}:${accessToken}`),
      "Content-Type": "application/json",
    }),
  });
}
