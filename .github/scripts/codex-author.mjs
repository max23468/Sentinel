const CODEX_AUTHOR_ID = 199175422;
const CODEX_AUTHOR_LOGIN = "chatgpt-codex-connector";

export function isTrustedCodexAuthor(author) {
  return (
    author?.__typename === "Bot" &&
    author.databaseId === CODEX_AUTHOR_ID &&
    author.login === CODEX_AUTHOR_LOGIN
  );
}
