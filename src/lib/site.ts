import corpusConfig from "@config";

/**
 * Site-level links. Single source is corpus.config.ts's repoUrl; re-exported
 * here so components only import site, not corpus.config.ts directly (same
 * pattern as copy.ts re-exporting siteName/greeting). null hides the GitHub
 * icon in the nav and the repo link on the "How this site works" page.
 */
export const REPO_URL: string | null = corpusConfig.repoUrl;
