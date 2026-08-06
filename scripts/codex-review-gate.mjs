import { pathToFileURL } from "node:url";

const CODEX_BOT = "chatgpt-codex-connector[bot]";
const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
// ponytail: 180 s limita cinque PR concorrenti a circa 500 richieste/ora; passare a
// un'unica query GraphQL se la concorrenza reale cresce oltre questo livello.
export const CODEX_REVIEW_POLLING = { attempts: 100, intervalMs: 180_000 };

const timestamp = (value) => new Date(value ?? 0).getTime();
const reviewedCommit = (body = "") =>
  body.match(/\*\*Reviewed commit:\*\*\s*`([0-9a-f]{10,40})`/i)?.[1];

export function classifyCodexReview({
  headSha,
  requestedAt,
  now = Date.now(),
  comments,
  exactReactions = [],
  attemptStartedAt = requestedAt,
  reactions,
  progressReactions = reactions,
  requiresReviewedCommit = false,
  reviews = [],
  reviewComments,
  unambiguousAttempt = false,
}) {
  const completions = [];
  const cleanComments = [];
  const latestEyesAt = progressReactions
    .filter(
      (reaction) =>
        reaction.user?.login === CODEX_BOT &&
        reaction.content === "eyes" &&
        timestamp(reaction.created_at) >= timestamp(requestedAt),
    )
    .reduce((latest, reaction) => Math.max(latest, timestamp(reaction.created_at)), 0);
  const exactEyesAt = exactReactions
    .filter(
      (reaction) =>
        reaction.user?.login === CODEX_BOT &&
        reaction.content === "eyes" &&
        timestamp(reaction.created_at) >= timestamp(requestedAt),
    )
    .reduce((latest, reaction) => Math.max(latest, timestamp(reaction.created_at)), 0);

  for (const comment of reviewComments) {
    if (
      comment.user?.login === CODEX_BOT &&
      (comment.original_commit_id ?? comment.commit_id) === headSha &&
      timestamp(comment.created_at) >= timestamp(requestedAt) &&
      /\bP[0-3]\b/.test(comment.body)
    ) {
      completions.push({
        state: "failure",
        at: timestamp(comment.created_at),
        description: "Codex ha trovato problemi nell'ultimo commit",
      });
    }
  }

  if (completions.length) {
    return completions.sort((left, right) => right.at - left.at)[0];
  }

  for (const comment of comments) {
    if (comment.user?.login !== CODEX_BOT) continue;

    const commit = reviewedCommit(comment.body);
    if (
      (commit
        ? headSha.startsWith(commit)
        : !requiresReviewedCommit && timestamp(requestedAt) > 0) &&
      timestamp(comment.created_at) >= timestamp(requestedAt) &&
      /\bP[0-3]\b/.test(comment.body)
    ) {
      completions.push({
        state: "failure",
        at: timestamp(comment.created_at),
        description: "Codex ha trovato problemi nell'ultimo commit",
      });
    }

    if (
      commit &&
      headSha.startsWith(commit) &&
      timestamp(comment.created_at) >= timestamp(requestedAt) &&
      /^Codex Review: Didn't find any major issues\./m.test(comment.body)
    ) {
      completions.push({
        state: "success",
        at: timestamp(comment.created_at),
        description: "Codex ha approvato l'ultimo commit",
      });
    }

    if (
      (commit
        ? headSha.startsWith(commit)
        : unambiguousAttempt) &&
      timestamp(requestedAt) > 0 &&
      timestamp(comment.created_at) >= timestamp(requestedAt) &&
      now - timestamp(requestedAt) >= 30_000 &&
      timestamp(comment.created_at) >=
        (commit
          ? timestamp(requestedAt)
          : requiresReviewedCommit
            ? exactEyesAt || timestamp(attemptStartedAt)
            : latestEyesAt || timestamp(attemptStartedAt)) &&
      /reached your Codex usage limits|could not complete|unable to review|something went wrong|unknown error/i.test(
        comment.body,
      )
    ) {
      completions.push({
        state: "failure",
        at: timestamp(comment.created_at),
        description: "La review Codex non è stata completata",
      });
    }
  }

  const commentFailure = completions
    .filter((completion) => completion.state === "failure")
    .sort((left, right) => right.at - left.at)[0];
  if (commentFailure) return commentFailure;

  for (const review of reviews) {
    const commit = review.commit_id ?? reviewedCommit(review.body);
    if (
      review.user?.login === CODEX_BOT &&
      commit &&
      headSha.startsWith(commit) &&
      timestamp(review.submitted_at) >= timestamp(requestedAt)
    ) {
      if (/\bP[0-3]\b/.test(review.body)) {
        completions.push({
          state: "failure",
          at: timestamp(review.submitted_at),
          description: "Codex ha trovato problemi nell'ultimo commit",
        });
      } else {
        cleanComments.push(timestamp(review.submitted_at));
      }
    }
  }

  const reviewFailure = completions.find((completion) => completion.state === "failure");
  if (reviewFailure) return reviewFailure;

  const thumbsUpAt = reactions
    .filter(
      (reaction) =>
        reaction.user?.login === CODEX_BOT &&
        reaction.content === "+1" &&
        timestamp(reaction.created_at) >= timestamp(requestedAt),
    )
    .reduce((latest, reaction) => Math.max(latest, timestamp(reaction.created_at)), 0);
  const exactThumbsUpAt = exactReactions
    .filter(
      (reaction) =>
        timestamp(requestedAt) > 0 &&
        reaction.user?.login === CODEX_BOT &&
        reaction.content === "+1" &&
        timestamp(reaction.created_at) >= timestamp(requestedAt),
    )
    .reduce((latest, reaction) => Math.max(latest, timestamp(reaction.created_at)), 0);

  if (thumbsUpAt) {
    if (!requiresReviewedCommit || exactThumbsUpAt) {
      cleanComments.push(exactThumbsUpAt || thumbsUpAt);
    }
    for (const commentAt of cleanComments) {
      if (thumbsUpAt < commentAt) continue;
      completions.push({
        state: "success",
        at: Math.max(thumbsUpAt, commentAt),
        description: "Codex ha approvato l'ultimo commit",
      });
    }
  }

  return (
    completions.sort((left, right) => right.at - left.at)[0] ?? {
      state: "pending",
      description: "In attesa della review Codex sull'ultimo commit",
    }
  );
}

export const hasSuccessfulCodexStatus = (statuses) =>
  statuses.find((status) => status.context === "codex-review")?.state === "success";

export const codexInvocations = (comments, requestedAt) =>
  comments
    .filter(
      (comment) =>
        timestamp(requestedAt) > 0 &&
        comment.user?.login !== CODEX_BOT &&
        /@codex\s+review\b/i.test(comment.body) &&
        timestamp(comment.created_at) >= timestamp(requestedAt),
    )
    .sort((left, right) => timestamp(right.created_at) - timestamp(left.created_at));

export const latestCodexInvocation = (comments, requestedAt) =>
  codexInvocations(comments, requestedAt)[0];

export function pullRequestNumber(event, input) {
  const number = String(event.pull_request?.number ?? input);
  if (!/^\d+$/.test(number)) throw new Error("Numero PR non valido");
  return number;
}

export const isRetryableGitHubResponse = (status, remaining) =>
  status === 429 || status >= 500 || (status === 403 && remaining === "0");

export const isCurrentCodexFinding = (event, headSha) => {
  const signal = event.review ?? event.comment;
  return (
    signal?.user?.login === CODEX_BOT &&
    (signal.original_commit_id ?? signal.commit_id) === headSha &&
    /\bP[0-3]\b/.test(signal.body ?? "")
  );
};

async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = new Error(`${options.method ?? "GET"} ${path}: ${response.status}`);
    error.retryable = isRetryableGitHubResponse(
      response.status,
      response.headers.get("x-ratelimit-remaining"),
    );
    throw error;
  }
  return response.json();
}

async function all(path) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const batch = await request(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function setStatus(repository, sha, state, description) {
  await request(`/repos/${repository}/statuses/${sha}`, {
    method: "POST",
    body: JSON.stringify({
      state,
      context: "codex-review",
      description,
      target_url: `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }),
  });
}

async function reviewSignals(repository, number, requestedAt) {
  const [comments, reactions, reviews, reviewComments] = await Promise.all([
    all(`/repos/${repository}/issues/${number}/comments`),
    all(`/repos/${repository}/issues/${number}/reactions`),
    all(`/repos/${repository}/pulls/${number}/reviews`),
    all(`/repos/${repository}/pulls/${number}/comments`),
  ]);
  const invocations = codexInvocations(comments, requestedAt);
  const invocation = invocations[0];
  const invocationReactions = invocation
    ? await all(`/repos/${repository}/issues/comments/${invocation.id}/reactions`)
    : [];
  return [
    comments,
    [...reactions, ...invocationReactions],
    reviews,
    reviewComments,
    invocationReactions,
    invocations.length,
    invocation?.created_at ?? requestedAt,
  ];
}

async function main() {
  const event = JSON.parse(
    await (await import("node:fs/promises")).readFile(process.env.GITHUB_EVENT_PATH),
  );
  const repository = process.env.GITHUB_REPOSITORY;
  const requestedNumber = pullRequestNumber(event, process.env.PULL_REQUEST_NUMBER);
  const pullRequest =
    event.pull_request ?? (await request(`/repos/${repository}/pulls/${requestedNumber}`));
  const number = pullRequest.number;
  const headSha = pullRequest.head.sha;
  if (process.env.GITHUB_EVENT_NAME.startsWith("pull_request_review")) {
    const signal = event.review ?? event.comment;
    if (signal?.user?.login !== CODEX_BOT) return;

    let finding = isCurrentCodexFinding(event, headSha);
    if (event.review && event.review.commit_id === headSha) {
      const reviewComments = await all(`/repos/${repository}/pulls/${number}/comments`);
      finding ||= reviewComments.some(
        (comment) =>
          comment.pull_request_review_id === event.review.id &&
          isCurrentCodexFinding({ comment }, headSha),
      );
      if (finding) {
        await setStatus(
          repository,
          headSha,
          "failure",
          "Codex ha trovato problemi nell'ultimo commit",
        );
        return;
      }
      const statuses = await all(`/repos/${repository}/commits/${headSha}/statuses`);
      const currentStatus = statuses.find((status) => status.context === "codex-review");
      if (currentStatus && currentStatus.state !== "pending") return;
    } else {
      if (finding) {
        await setStatus(
          repository,
          headSha,
          "failure",
          "Codex ha trovato problemi nell'ultimo commit",
        );
      }
      return;
    }
  }
  const reusesExistingReview =
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" || event.action === "reopened";

  if (reusesExistingReview) {
    const statuses = await all(`/repos/${repository}/commits/${headSha}/statuses`);
    if (hasSuccessfulCodexStatus(statuses)) return;
  }

  await setStatus(
    repository,
    headSha,
    "pending",
    "In attesa della review Codex sull'ultimo commit",
  );
  if (pullRequest.draft) return;

  if (["opened", "ready_for_review"].includes(event.action)) {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    const currentPullRequest = await request(`/repos/${repository}/pulls/${number}`);
    if (currentPullRequest.head.sha !== headSha) return;
  }

  const freshReview = ["opened", "ready_for_review"].includes(event.action);
  const requestedAt = reusesExistingReview ? 0 : pullRequest.updated_at;
  for (let attempt = 0; attempt < CODEX_REVIEW_POLLING.attempts; attempt += 1) {
    let signals;
    try {
      signals = await reviewSignals(repository, number, requestedAt);
    } catch (error) {
      if (!(error instanceof TypeError) && !error.retryable) throw error;
      console.warn(`Lettura GitHub transitoria, nuovo tentativo: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, CODEX_REVIEW_POLLING.intervalMs));
      continue;
    }
    const [
      comments,
      reactions,
      reviews,
      reviewComments,
      exactReactions,
      invocationCount,
      attemptStartedAt,
    ] = signals;
    const result = classifyCodexReview({
      headSha,
      requestedAt,
      comments,
      exactReactions,
      attemptStartedAt,
      reactions,
      requiresReviewedCommit: !freshReview,
      reviews,
      reviewComments,
      unambiguousAttempt: freshReview ? invocationCount === 0 : invocationCount === 1,
    });
    if (result.state !== "pending") {
      await setStatus(repository, headSha, result.state, result.description);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, CODEX_REVIEW_POLLING.intervalMs));
  }

  await setStatus(repository, headSha, "error", "Review Codex non conclusa entro cinque ore");
}

if (process.env.GITHUB_ACTIONS === "true" && isDirectExecution) {
  await main().catch(async (error) => {
    console.error(error);
    const event = JSON.parse(
      await (await import("node:fs/promises")).readFile(process.env.GITHUB_EVENT_PATH),
    );
    let requestedNumber;
    try {
      requestedNumber = pullRequestNumber(event, process.env.PULL_REQUEST_NUMBER);
    } catch {
      process.exitCode = 1;
      return;
    }
    const pullRequest =
      event.pull_request ??
      (await request(`/repos/${process.env.GITHUB_REPOSITORY}/pulls/${requestedNumber}`).catch(
        () => null,
      ));
    if (!pullRequest) {
      process.exitCode = 1;
      return;
    }
    try {
      await setStatus(
        process.env.GITHUB_REPOSITORY,
        pullRequest.head.sha,
        "error",
        "Impossibile verificare la review Codex",
      );
    } catch (statusError) {
      console.error(statusError);
      process.exitCode = 1;
    }
  });
}
