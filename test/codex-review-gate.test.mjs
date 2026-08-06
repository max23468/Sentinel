import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import {
  CODEX_REVIEW_POLLING,
  classifyCodexReview,
  hasSuccessfulCodexStatus,
  isCurrentCodexFinding,
  isRetryableGitHubResponse,
  latestCodexInvocation,
  pullRequestNumber,
} from "../scripts/codex-review-gate.mjs";

const headSha = "0123456789abcdef0123456789abcdef01234567";
const requestedAt = "2026-08-04T12:00:00Z";
const bot = { login: "chatgpt-codex-connector[bot]" };

const classify = (overrides = {}) =>
  classifyCodexReview({
    headSha,
    requestedAt,
    now: new Date(requestedAt).getTime() + 60_000,
    comments: [],
    reactions: [],
    reviewComments: [],
    ...overrides,
  });

test("resta pending senza un esito Codex", () => {
  assert.equal(classify().state, "pending");
});

test("approva la review iniziale soltanto con la reazione del bot", () => {
  assert.equal(
    classify({
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
    }).state,
    "success",
  );
  assert.equal(
    classify({
      reactions: [
        { user: { login: "utente" }, content: "+1", created_at: "2026-08-04T12:00:03Z" },
      ],
    }).state,
    "pending",
  );
});

test("approva tramite review dell'HEAD e commit_id con corpo vuoto", () => {
  for (const review of [
    {
      user: bot,
      submitted_at: "2026-08-04T12:00:02Z",
      body: `**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
    },
    { user: bot, commit_id: headSha, submitted_at: "2026-08-04T12:00:02Z", body: "" },
  ]) {
    assert.equal(
      classify({
        requiresReviewedCommit: true,
        reviews: [review],
        reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
      }).state,
      "success",
    );
  }
});

test("approva tramite reazione sulla singola invocazione corrente", () => {
  const reaction = { user: bot, content: "+1", created_at: "2026-08-04T12:00:01Z" };
  assert.equal(
    classify({
      exactReactions: [reaction],
      reactions: [reaction],
      requiresReviewedCommit: true,
    }).state,
    "success",
  );
});

test("non riusa approvazioni o reazioni di SHA e tentativi precedenti", () => {
  const oldReaction = { user: bot, content: "+1", created_at: "2026-08-04T11:59:59Z" };
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      reviews: [
        {
          user: bot,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "**Reviewed commit:** `abcdef0123`",
        },
      ],
      reactions: [oldReaction],
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P2** Finding tardivo del commit precedente",
        },
      ],
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      requestedAt: 0,
      exactReactions: [{ ...oldReaction, created_at: "2026-08-04T12:00:01Z" }],
      reactions: [{ ...oldReaction, created_at: "2026-08-04T12:00:01Z" }],
      requiresReviewedCommit: true,
    }).state,
    "pending",
  );
});

test("un finding P0-P3 corrente prevale sempre sull'approvazione", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Correggi questo caso",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:02Z" }],
    }).state,
    "failure",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `**P3** Problema.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
        {
          user: bot,
          created_at: "2026-08-04T12:00:02Z",
          body: `Codex Review: Didn't find any major issues.\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "failure",
  );
  assert.equal(
    classify({
      reviews: [
        {
          user: bot,
          commit_id: headSha,
          submitted_at: "2026-08-04T12:00:01Z",
          body: "**P2** Finding nel corpo della review",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:02Z" }],
    }).state,
    "failure",
  );
});

test("riattiva il gate soltanto per finding Codex exact-HEAD", () => {
  assert.equal(
    isCurrentCodexFinding(
      { review: { user: bot, commit_id: headSha, body: "**P2** Finding tardivo" } },
      headSha,
    ),
    true,
  );
  assert.equal(
    isCurrentCodexFinding(
      {
        comment: {
          user: bot,
          original_commit_id: "abcdef0123456789abcdef0123456789abcdef01",
          body: "**P1** Finding vecchio",
        },
      },
      headSha,
    ),
    false,
  );
  assert.equal(
    isCurrentCodexFinding(
      { comment: { user: { login: "utente" }, commit_id: headSha, body: "**P0** Falso" } },
      headSha,
    ),
    false,
  );
});

test("rebase e nuovo commit invalidano finding e approvazioni precedenti", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          commit_id: headSha,
          original_commit_id: "abcdef0123456789abcdef0123456789abcdef01",
          created_at: "2026-08-04T12:00:01Z",
          body: "**P1** Finding già corretto",
        },
      ],
      reviews: [
        {
          user: bot,
          submitted_at: "2026-08-04T12:00:02Z",
          body: "**Reviewed commit:** `abcdef0123`",
        },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
      requiresReviewedCommit: true,
    }).state,
    "pending",
  );
});

test("un retry pulito sullo stesso SHA ignora finding ed errori precedenti", () => {
  assert.equal(
    classify({
      reviewComments: [
        {
          user: bot,
          original_commit_id: headSha,
          created_at: "2026-08-04T11:59:59Z",
          body: "**P2** Finding precedente",
        },
      ],
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T11:59:59Z",
          body: "Codex could not complete the review",
        },
      ],
      reviews: [
        { user: bot, commit_id: headSha, submitted_at: "2026-08-04T12:00:02Z", body: "" },
      ],
      reactions: [{ user: bot, content: "+1", created_at: "2026-08-04T12:00:03Z" }],
      requiresReviewedCommit: true,
    }).state,
    "success",
  );
});

test("usage limit e unknown error falliscono il tentativo corrente", () => {
  for (const body of [
    "You have reached your Codex usage limits for code reviews.",
    "Codex Review: Something went wrong. Try again later. Unknown error",
  ]) {
    assert.equal(
      classify({
        comments: [{ user: bot, created_at: "2026-08-04T12:00:01Z", body }],
        unambiguousAttempt: true,
      }).state,
      "failure",
    );
  }
});

test("ignora errori tardivi non associati all'HEAD dopo synchronize", () => {
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: "Codex could not complete the review",
        },
      ],
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        {
          user: bot,
          created_at: "2026-08-04T12:00:01Z",
          body: `Codex could not complete the review\n\n**Reviewed commit:** \`${headSha.slice(0, 10)}\``,
        },
      ],
    }).state,
    "failure",
  );
});

test("eyes mantiene pending finché non arriva un errore successivo", () => {
  const progressReactions = [
    { user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" },
  ];
  assert.equal(
    classify({
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:01Z", body: "Codex could not complete" },
      ],
      progressReactions,
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      progressReactions,
      unambiguousAttempt: true,
    }).state,
    "failure",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      progressReactions: [
        { user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" },
      ],
    }).state,
    "pending",
  );
  const exactEyes = { user: bot, content: "eyes", created_at: "2026-08-04T12:00:02Z" };
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      exactReactions: [exactEyes],
      progressReactions: [exactEyes],
      unambiguousAttempt: true,
    }).state,
    "failure",
  );
  assert.equal(
    classify({
      requiresReviewedCommit: true,
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      exactReactions: [exactEyes],
      progressReactions: [exactEyes],
      unambiguousAttempt: false,
    }).state,
    "pending",
  );
  assert.equal(
    classify({
      comments: [
        { user: bot, created_at: "2026-08-04T12:00:03Z", body: "Codex could not complete" },
      ],
      progressReactions: [exactEyes],
      unambiguousAttempt: false,
    }).state,
    "pending",
  );
});

test("trova solo l'ultima invocazione umana del tentativo corrente", () => {
  assert.equal(
    latestCodexInvocation(
      [
        { id: 1, user: bot, body: "@codex review", created_at: "2026-08-04T12:00:03Z" },
        {
          id: 2,
          user: { login: "max23468" },
          body: "@codex review",
          created_at: "2026-08-04T12:00:01Z",
        },
        {
          id: 3,
          user: { login: "max23468" },
          body: "@codex review",
          created_at: "2026-08-04T12:00:02Z",
        },
      ],
      requestedAt,
    ).id,
    3,
  );
  assert.equal(latestCodexInvocation([], 0), undefined);
});

test("valida rigidamente il numero PR", () => {
  assert.equal(pullRequestNumber({ pull_request: { number: 42 } }), "42");
  assert.equal(pullRequestNumber({}, "208"), "208");
  assert.throws(() => pullRequestNumber({}, "208/merge"), /Numero PR non valido/);
});

test("ritenta soltanto errori GitHub recuperabili", () => {
  assert.equal(isRetryableGitHubResponse(429, null), true);
  assert.equal(isRetryableGitHubResponse(502, null), true);
  assert.equal(isRetryableGitHubResponse(403, "0"), true);
  assert.equal(isRetryableGitHubResponse(403, "4999"), false);
  assert.equal(isRetryableGitHubResponse(404, null), false);
});

test("il polling copre cinque ore senza saturare la quota con cinque PR", () => {
  assert.equal(CODEX_REVIEW_POLLING.attempts, 100);
  assert.equal(CODEX_REVIEW_POLLING.intervalMs, 180_000);
  assert.equal(CODEX_REVIEW_POLLING.attempts * CODEX_REVIEW_POLLING.intervalMs, 5 * 60 * 60 * 1000);
  assert.ok((5 * 5 * 60 * 60 * 1000) / CODEX_REVIEW_POLLING.intervalMs <= 500);
});

test("un rerun riusa solo lo status Codex più recente dello stesso SHA", () => {
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "success" },
      { context: "codex-review", state: "pending" },
    ]),
    true,
  );
  assert.equal(
    hasSuccessfulCodexStatus([
      { context: "codex-review", state: "failure" },
      { context: "codex-review", state: "success" },
    ]),
    false,
  );
});

test("l'import in GitHub Actions non avvia la CLI", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", `import(${JSON.stringify(import.meta.resolve("../scripts/codex-review-gate.mjs"))})`],
    {
      env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_PATH: "/non-esiste" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("un doppio errore API non lascia verde il job senza status", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../scripts/codex-review-gate.mjs", import.meta.url), "utf8"),
  );

  assert.match(source, /catch \(statusError\)[\s\S]*process\.exitCode = 1/);
  assert.match(source, /if \(!pullRequest\) \{\s*process\.exitCode = 1/);
  assert.match(source, /comment\.pull_request_review_id === event\.review\.id/);
});
