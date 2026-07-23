/**
 * GravityWorker - GitHub App Manifest Flow & JWT Auth
 *
 * Provides single-click GitHub App creation via POST form manifest submission,
 * RSA PKCS1/PKCS8 private key parsing, RS256 JWT generation, and installation token exchange.
 *
 * @module gravity-worker/github_app
 */

export interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
  slug: string;
  htmlUrl: string;
}

export interface ManifestOptions {
  appName?: string;
  appUrl?: string;
  callbackUrl?: string;
  setupUrl?: string;
}

/**
 * Builds the official GitHub App Manifest specification.
 */
export function buildAppManifest(options: ManifestOptions = {}): Record<string, unknown> {
  const {
    appName = "gravity-worker",
    appUrl = "https://github.com/atzufuki/gravity-worker",
    callbackUrl = "http://localhost:3000",
  } = options;

  return {
    name: appName,
    url: appUrl,
    hook_attributes: {
      url: "https://example.com/webhook",
      active: false,
    },
    redirect_url: callbackUrl,
    public: true,
    default_permissions: {
      contents: "write",
      issues: "write",
      pull_requests: "write",
      actions: "read",
    },
    default_events: [
      "issues",
      "issue_comment",
      "label",
    ],
  };
}

/**
 * Converts a raw code from GitHub Manifest creation redirect into GitHub App Credentials.
 */
export async function exchangeManifestCode(code: string): Promise<GitHubAppCredentials> {
  const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GravityWorker",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to exchange GitHub App manifest code (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    appId: String(data.id),
    privateKey: data.pem,
    slug: data.slug,
    htmlUrl: data.html_url,
  };
}

/**
 * Wraps PKCS#1 RSA private key DER bytes into PKCS#8 PrivateKeyInfo structure
 * to enable native Deno / Web Crypto importKey("pkcs8", ...).
 */
function convertPkcs1ToPkcs8(pkcs1Der: Uint8Array): Uint8Array {
  // Check if it's already PKCS#8 (contains rsaEncryption OID: 1.2.840.113549.1.1.1)
  const rsaOid = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  for (let i = 0; i < Math.min(pkcs1Der.length - 9, 30); i++) {
    if (pkcs1Der.subarray(i, i + 9).every((b, idx) => b === rsaOid[idx])) {
      return pkcs1Der;
    }
  }

  const encodeLength = (len: number): Uint8Array => {
    if (len < 128) return new Uint8Array([len]);
    if (len < 256) return new Uint8Array([0x81, len]);
    if (len < 65536) return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
    return new Uint8Array([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  };

  // AlgorithmIdentifier: rsaEncryption OID + NULL
  const algId = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ]);

  // Version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  // OCTET STRING wrapping pkcs1Der
  const octetLen = encodeLength(pkcs1Der.length);
  const octetString = new Uint8Array(1 + octetLen.length + pkcs1Der.length);
  octetString[0] = 0x04;
  octetString.set(octetLen, 1);
  octetString.set(pkcs1Der, 1 + octetLen.length);

  // Outer SEQUENCE wrapping (version + algId + octetString)
  const innerLen = version.length + algId.length + octetString.length;
  const seqLen = encodeLength(innerLen);
  const pkcs8 = new Uint8Array(1 + seqLen.length + innerLen);
  pkcs8[0] = 0x30;
  pkcs8.set(seqLen, 1);

  let offset = 1 + seqLen.length;
  pkcs8.set(version, offset);
  offset += version.length;
  pkcs8.set(algId, offset);
  offset += algId.length;
  pkcs8.set(octetString, offset);

  return pkcs8;
}

/**
 * Converts a PEM RSA private key string into a CryptoKey for signing RS256 JWTs.
 * Supports both PKCS#1 (-----BEGIN RSA PRIVATE KEY-----) and PKCS#8 (-----BEGIN PRIVATE KEY-----).
 */
async function importRsaPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const pkcs8Der = convertPkcs1ToPkcs8(binaryDer);

  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der.buffer as unknown as ArrayBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

/**
 * Generates an RS256 signed JWT for GitHub App authentication.
 */
export async function createGitHubAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const key = await importRsaPrivateKey(privateKeyPem);

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encodeBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );

  const signatureBase64Url = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signatureBase64Url}`;
}

/**
 * Retrieves a short-lived installation access token for a repository using GitHub App credentials.
 */
export async function getAppInstallationToken(
  appId: string,
  privateKeyPem: string,
  owner: string,
  repo: string,
): Promise<string | null> {
  try {
    const jwt = await createGitHubAppJwt(appId, privateKeyPem);

    // 1. Get installation for repository
    const instRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${jwt}`,
        "User-Agent": "GravityWorker",
      },
    });

    if (!instRes.ok) return null;
    const instData = await instRes.json();
    const installationId = instData.id;

    // 2. Create access token
    const tokenRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${jwt}`,
        "User-Agent": "GravityWorker",
      },
    });

    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    return tokenData.token ?? null;
  } catch (err) {
    console.warn(`[GitHub App Auth] Unable to obtain installation token:`, err);
    return null;
  }
}

/**
 * Starts a temporary local HTTP server on http://localhost:3000 to auto-submit the GitHub App
 * manifest POST form (pre-filling 100% of fields) and receive the callback.
 */
export async function listenForManifestCallback(
  manifestOptions: ManifestOptions = {},
  port = 3000,
  timeoutMs = 120000,
): Promise<GitHubAppCredentials> {
  const controller = new AbortController();
  const { signal } = controller;
  const manifest = buildAppManifest(manifestOptions);
  const manifestJsonStr = JSON.stringify(manifest);

  let credentialsResolver: (value: GitHubAppCredentials) => void;
  let credentialsRejecter: (reason: Error) => void;

  const promise = new Promise<GitHubAppCredentials>((resolve, reject) => {
    credentialsResolver = resolve;
    credentialsRejecter = reject;
  });

  const server = Deno.serve(
    { port, signal, onListen: () => {} },
    async (req: Request) => {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");

      // Step 2: Receive OAuth callback from GitHub after App creation
      if (code) {
        try {
          const credentials = await exchangeManifestCode(code);
          credentialsResolver(credentials);
          setTimeout(() => controller.abort(), 500);

          return new Response(
            `<!DOCTYPE html>
            <html><body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0d1117;color:#c9d1d9;">
              <h2 style="color:#58a6ff;">🎉 GitHub App Created Successfully!</h2>
              <p>GravityWorker is setting up your repository...</p>
            </body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          credentialsRejecter(new Error(errorMsg));
          setTimeout(() => controller.abort(), 500);
          return new Response(`Error: ${errorMsg}`, { status: 500 });
        }
      }

      // Step 1: Auto-submit POST form to GitHub to pre-fill 100% of form fields
      const escapedManifest = manifestJsonStr.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Register GravityWorker GitHub App</title>
      </head>
      <body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0d1117;color:#c9d1d9;">
        <h2 style="color:#58a6ff;">🚀 Registering GravityWorker GitHub App...</h2>
        <p>Redirecting to GitHub with 100% pre-filled fields & permissions...</p>
        <form id="manifestForm" action="https://github.com/settings/apps/new" method="post">
          <input type="hidden" name="manifest" value="${escapedManifest}">
        </form>
        <script>
          document.getElementById('manifestForm').submit();
        </script>
      </body>
      </html>`;

      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  );

  const timeoutId = setTimeout(() => {
    controller.abort();
    credentialsRejecter(new Error("Timeout waiting for GitHub App callback"));
  }, timeoutMs);

  try {
    const creds = await promise;
    clearTimeout(timeoutId);
    return creds;
  } catch (err) {
    clearTimeout(timeoutId);
    await server.finished.catch(() => {});
    throw err;
  }
}

/**
 * Enables PR creation and write permissions on a GitHub repository via API.
 */
export async function enableRepoWorkflowPermissions(
  owner: string,
  repo: string,
  token: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/permissions/workflow`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "GravityWorker",
      },
      body: JSON.stringify({
        default_workflow_permissions: "write",
        can_approve_pull_request_reviews: true,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Automatically sets a repository secret using GitHub CLI (gh secret set).
 */
export async function setRepoSecretWithGh(
  secretName: string,
  secretValue: string,
  repoSpec?: string,
): Promise<boolean> {
  try {
    const args = ["secret", "set", secretName, "-b", secretValue];
    if (repoSpec) {
      args.push("--repo", repoSpec);
    }
    const command = new Deno.Command("gh", {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    return output.success;
  } catch {
    return false;
  }
}

/**
 * Creates or updates the GravityWorker workflow file in a repository directory.
 */
export async function createWorkflowFile(repoDir = "."): Promise<string> {
  const workflowDir = `${repoDir}/.github/workflows`;
  await Deno.mkdir(workflowDir, { recursive: true });
  const workflowPath = `${workflowDir}/gravity-worker.yml`;

  const content = `name: GravityWorker Agent Automation

on:
  issues:
    types: [labeled]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      prompt:
        description: 'Task instructions for GravityWorker'
        required: true
      agent:
        description: 'Agent engine (default: antigravity)'
        required: false
        default: 'antigravity'

jobs:
  gravity-worker:
    if: >-
      (github.event_name == 'issues' && github.event.label.name == 'gravity-fix') ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@gravity-worker')) ||
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest

    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run GravityWorker Agent
        uses: atzufuki/gravity-worker@main
        with:
          prompt: \${{ github.event.inputs.prompt || github.event.issue.title || github.event.comment.body }}
          agent: \${{ github.event.inputs.agent || 'antigravity' }}
          issue-id: \${{ github.event.issue.number }}
          github-token: \${{ secrets.GITHUB_TOKEN }}
          gemini-api-key: \${{ secrets.GEMINI_API_KEY }}
          app-id: \${{ secrets.GRAVITY_WORKER_APP_ID }}
          private-key: \${{ secrets.GRAVITY_WORKER_PRIVATE_KEY }}
`;

  await Deno.writeTextFile(workflowPath, content);
  return workflowPath;
}
