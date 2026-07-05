#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET_BRANCH = process.env.WCPT_RECONCILE_TARGET_BRANCH || 'master';
const UPSTREAM_REF = process.env.WCPT_RECONCILE_UPSTREAM_REF || 'origin/master';
const OUTPUT_DIR = path.join(ROOT, 'tmp/outputs/reconciliation-branch-handoff-20260705');
const OUTPUT_PREFIX = path.relative(ROOT, OUTPUT_DIR).replaceAll(path.sep, '/');
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'result.md');

const result = buildResult();
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(REPORT_PATH, renderMarkdown(result));

console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
console.log(`report=${path.relative(ROOT, REPORT_PATH)}`);
console.log(`reconciliation_handoff=${result.readyForBranchReview ? 'ready_for_branch_review' : 'blocked'}`);
console.log(`original_master_update=${result.originalWorktree.directUpdateAllowed ? 'allowed' : 'blocked'}`);

function buildResult() {
  const sourceBranch = gitText(['branch', '--show-current']);
  const sourceHead = gitText(['rev-parse', 'HEAD']);
  const sourceStatus = statusEntries(ROOT);
  const targetHead = gitText(['rev-parse', TARGET_BRANCH]);
  const upstreamHead = gitText(['rev-parse', UPSTREAM_REF]);
  const mergeBaseTarget = gitText(['merge-base', sourceHead, targetHead]);
  const mergeBaseUpstream = gitText(['merge-base', sourceHead, upstreamHead]);
  const targetAncestorOfSource = gitOk(['merge-base', '--is-ancestor', targetHead, sourceHead]);
  const upstreamAncestorOfSource = gitOk(['merge-base', '--is-ancestor', upstreamHead, sourceHead]);
  const worktrees = parseWorktrees();
  const originalWorktree = worktrees.find(worktree => worktree.branch === `refs/heads/${TARGET_BRANCH}`) || null;
  const originalStatus = originalWorktree ? statusEntries(originalWorktree.worktree) : [];
  const commitLines = gitLines(['log', '--oneline', `${targetHead}..${sourceHead}`]);
  const changedFiles = gitLines(['diff', '--name-status', `${targetHead}..${sourceHead}`]);
  const blockingReasons = [];

  if (sourceStatus.length > 0) blockingReasons.push('source_worktree_dirty');
  if (!targetAncestorOfSource) blockingReasons.push('target_not_ancestor_of_source');
  if (!upstreamAncestorOfSource) blockingReasons.push('upstream_not_ancestor_of_source');
  if (!originalWorktree) blockingReasons.push('target_worktree_not_found');
  if (originalStatus.length > 0) blockingReasons.push('target_worktree_dirty');

  return {
    schema: 'wcpt.reconciliation_branch_handoff.v1',
    checkedAt: new Date().toISOString(),
    repositoryRoot: ROOT,
    sourceBranch,
    sourceHead,
    sourceWorktreeClean: sourceStatus.length === 0,
    sourceStatus,
    targetBranch: TARGET_BRANCH,
    targetHead,
    upstreamRef: UPSTREAM_REF,
    upstreamHead,
    mergeBaseTarget,
    mergeBaseUpstream,
    targetAncestorOfSource,
    upstreamAncestorOfSource,
    commitsAheadOfTarget: commitLines,
    commitCountAheadOfTarget: commitLines.length,
    changedFilesFromTarget: changedFiles,
    changedFileCountFromTarget: changedFiles.length,
    originalWorktree: {
      path: originalWorktree?.worktree || null,
      branch: originalWorktree?.branch || null,
      clean: originalStatus.length === 0,
      status: originalStatus,
      directUpdateAllowed: false,
      directUpdateBlockedReasons: [
        ...(originalStatus.length > 0 ? ['target_worktree_dirty'] : []),
        'explicit_approval_required',
        'destructive_update_not_executed',
      ],
    },
    readyForBranchReview: blockingReasons.filter(reason => reason !== 'target_worktree_dirty').length === 0,
    originalMasterCanBeUpdatedAfterApproval: targetAncestorOfSource,
    blockedGates: {
      push_executed: false,
      merge_executed: false,
      reset_executed: false,
      deploy_attempted: false,
      provider_call: false,
      production_changed: false,
      production_readonly_check_executed: false,
    },
    blockingReasons,
    recommendedNextActions: [
      'Review the reconciliation branch as the release candidate.',
      'Preserve or intentionally discard original master dirty-state only after explicit approval.',
      'After dirty-state resolution and approval, update the original master worktree to the reconciliation branch or push the reconciliation branch for review.',
      'Keep deploy, production read-only inventory, runtime key injection, and provider live calls as separate gates.',
    ],
  };
}

function gitText(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitLines(args, cwd = ROOT) {
  const output = gitText(args, cwd);
  return output ? output.split('\n') : [];
}

function gitOk(args, cwd = ROOT) {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function statusEntries(cwd) {
  const entries = gitLines(['status', '--short', '--untracked-files=all'], cwd);
  if (path.resolve(cwd) !== ROOT) return entries;
  return entries.filter(entry => {
    const filePath = entry.slice(3).split(' -> ').pop();
    return !filePath.startsWith(`${OUTPUT_PREFIX}/`);
  });
}

function parseWorktrees() {
  const lines = gitLines(['worktree', 'list', '--porcelain']);
  const worktrees = [];
  let current = {};
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.worktree) worktrees.push(current);
      current = { worktree: line.slice('worktree '.length) };
      continue;
    }
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length);
    if (line.startsWith('branch ')) current.branch = line.slice('branch '.length);
  }
  if (current.worktree) worktrees.push(current);
  return worktrees;
}

function renderMarkdown(result) {
  return `---
title: Reconciliation Branch Handoff Audit
date: 2026-07-05
status: ${result.readyForBranchReview ? 'ready_for_branch_review' : 'blocked'}
schema: ${result.schema}
---

# Reconciliation Branch Handoff Audit

## Summary

- Source branch: \`${result.sourceBranch}\`
- Source head: \`${result.sourceHead}\`
- Target branch: \`${result.targetBranch}\`
- Target head: \`${result.targetHead}\`
- Upstream ref: \`${result.upstreamRef}\`
- Upstream head: \`${result.upstreamHead}\`
- Source worktree clean: \`${result.sourceWorktreeClean}\`
- Target ancestor of source: \`${result.targetAncestorOfSource}\`
- Upstream ancestor of source: \`${result.upstreamAncestorOfSource}\`
- Ready for branch review: \`${result.readyForBranchReview}\`
- Original master direct update allowed: \`${result.originalWorktree.directUpdateAllowed}\`

## Original Worktree

- Path: \`${result.originalWorktree.path || 'not_found'}\`
- Clean: \`${result.originalWorktree.clean}\`
- Direct update blocked reasons: ${result.originalWorktree.directUpdateBlockedReasons.map(reason => `\`${reason}\``).join(', ')}

## Commits Ahead Of Target

${renderList(result.commitsAheadOfTarget)}

## Changed Files From Target

${renderList(result.changedFilesFromTarget)}

## Blocked Gates

${Object.entries(result.blockedGates).map(([key, value]) => `- \`${key}=${value}\``).join('\n')}

## Recommended Next Actions

${result.recommendedNextActions.map(action => `- ${action}`).join('\n')}
`;
}

function renderList(items) {
  if (items.length === 0) return '- none';
  return items.map(item => `- \`${item}\``).join('\n');
}
