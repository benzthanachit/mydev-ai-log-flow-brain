'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function SettingsPage() {
  const [githubPat, setGithubPat] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setGithubPat(data.github_pat || '');
          setGithubRepo(data.github_repo || '');
          setGeminiApiKey(data.gemini_api_key || '');
          setSlackWebhookUrl(data.slack_webhook_url || '');
        } else if (error && error.code === 'PGRST116') {
          // Profile doesn't exist, create it empty
          await supabase.from('profiles').insert([{ id: user.id, email: user.email }]);
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        github_pat: githubPat,
        github_repo: githubRepo,
        gemini_api_key: geminiApiKey,
        slack_webhook_url: slackWebhookUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Settings saved successfully!');
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 py-4 px-6 flex justify-between items-center bg-white dark:bg-black">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight hover:underline">Log-Flow</Link>
          <span className="text-zinc-500">/ Settings</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>Sign Out</Button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile & Integrations</CardTitle>
            <CardDescription>
              Configure your API keys to enable GitHub sync, AI Standup, and Slack notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading settings...</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">GitHub Sync</h3>
                  <div className="space-y-2">
                    <Label htmlFor="githubRepo">Repository Name (e.g. username/repo)</Label>
                    <Input 
                      id="githubRepo" 
                      placeholder="username/log-flow-data" 
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="githubPat">Personal Access Token (PAT)</Label>
                    <Input 
                      id="githubPat" 
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx" 
                      value={githubPat}
                      onChange={(e) => setGithubPat(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500">Needs repo scope to read/write Markdown files.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">AI & Notifications</h3>
                  <div className="space-y-2">
                    <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                    <Input 
                      id="geminiApiKey" 
                      type="password"
                      placeholder="AIzaSy..." 
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
                    <Input 
                      id="slackWebhookUrl" 
                      type="url"
                      placeholder="https://hooks.slack.com/services/..." 
                      value={slackWebhookUrl}
                      onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    />
                  </div>
                </div>

                {message && (
                  <p className={`text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {message}
                  </p>
                )}

                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
