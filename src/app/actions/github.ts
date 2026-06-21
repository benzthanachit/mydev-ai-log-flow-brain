'use server';

import { createClient } from '@/lib/supabase/server';
import { Octokit } from 'octokit';
import { fetchLogsForDate } from './logs';

// Helper to get Octokit instance for the current user
async function getGithubService() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('github_pat, github_repo')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.github_pat || !profile.github_repo) {
    throw new Error('GitHub settings not configured. Please go to Settings.');
  }

  const [owner, repo] = profile.github_repo.split('/');
  if (!owner || !repo) throw new Error('Invalid repository format. Use owner/repo.');

  const octokit = new Octokit({ auth: profile.github_pat });
  return { octokit, owner, repo };
}

export async function backupDailyToGithub() {
  try {
    const { octokit, owner, repo } = await getGithubService();
    const dateString = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const { logs, error: fetchError } = await fetchLogsForDate(dateString);
    
    if (fetchError || !logs) {
      throw new Error(fetchError || 'Failed to fetch today logs');
    }

    const path = `${dateString}.md`;

    // Format logs into a single markdown string
    let markdownContent = `# Log for ${dateString}\n\n`;
    
    const daily = logs.find(l => l.entry_type === 'daily');
    if (daily) markdownContent += `## Morning Daily\n${daily.content}\n\n`;

    const simpleLogs = logs.filter(l => l.entry_type === 'log');
    if (simpleLogs.length > 0) {
      markdownContent += `## Logs\n`;
      simpleLogs.forEach(l => {
        const time = new Date(l.created_at).toLocaleTimeString();
        markdownContent += `### [${time}]\n${l.content}\n\n`;
      });
    }

    const summary = logs.find(l => l.entry_type === 'summary');
    if (summary) markdownContent += `## Evening Summary\n${summary.content}\n\n`;

    // Check if file exists to get sha
    let sha;
    try {
      const existing = await octokit.rest.repos.getContent({ owner, repo, path });
      if (!Array.isArray(existing.data) && existing.data.type === 'file') {
        sha = existing.data.sha;
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `docs: backup logs for ${dateString}`,
      content: Buffer.from(markdownContent).toString('base64'),
      sha,
    });

    return { success: true, sha: response.data.content?.sha };
  } catch (error: any) {
    if (!error.message?.includes('GitHub settings not configured')) {
      console.error('Error backing up to github:', error);
    }
    return { error: error.message };
  }
}
