'use client';

import { useState, useEffect, use } from 'react';
import { RichTextInput } from '@/components/editor/RichTextInput';
import { fetchLogsForDate, saveLogEntry, updateLogEntry, type LogType } from '@/app/actions/logs';
import { backupDailyToGithub } from '@/app/actions/github';
import { pushToSlack } from '@/app/actions/ai';
import { Button } from '@/components/ui/button';
import { Loader2, CloudUpload, CheckCircle2, Send, ArrowLeft, Settings, MessageSquare, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

export default function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [pushingSlack, setPushingSlack] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);

  const { date: dateString } = use(params);
  
  // To avoid hydrating issues with Dates, we do simple string matching
  const isToday = new Date().toLocaleDateString('sv-SE') === dateString;

  const loadLogs = async () => {
    const res = await fetchLogsForDate(dateString);
    if (res.logs) setLogs(res.logs);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateString]);

  const handleSave = async (type: LogType, content: string) => {
    const res = await saveLogEntry(type, content, dateString);
    if (res.success) {
      await loadLogs();
      if (type === 'daily' || type === 'summary') {
        if (confirm(`Saved ${type}! Do you want to push this to Slack now?`)) {
          setPushingSlack(true);
          const slackRes = await pushToSlack(content);
          if (slackRes.success) alert('Pushed to Slack!');
          else alert(`Slack Error: ${slackRes.error}`);
          setPushingSlack(false);
        }
      }
    } else {
      alert(`Error saving: ${res.error}`);
    }
  };

  const handleUpdate = async (id: bigint, content: string) => {
    const res = await updateLogEntry(id, content);
    if (res.success) {
      await loadLogs();
      setEditingLogId(null);
    } else {
      alert(`Error updating: ${res.error}`);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    const res = await backupDailyToGithub();
    if (res.success) {
      alert('Backed up to GitHub successfully!');
    } else {
      alert(`Error backing up: ${res.error}`);
    }
    setBackingUp(false);
  };

  const dailyLog = logs.find(l => l.entry_type === 'daily');
  const summaryLog = logs.find(l => l.entry_type === 'summary');
  const simpleLogs = logs.filter(l => l.entry_type === 'log');

  if (loading) {
    return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;
  }

  return (
    <div className="w-full flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 py-4 px-6 flex justify-between items-center bg-white dark:bg-black">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight hover:underline">Log-Flow</Link>
          <span className="text-zinc-500">/ {dateString}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="gap-2"><MessageSquare size={16} className="hidden sm:inline" /> Chat</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-2"><Settings size={16} className="hidden sm:inline" /> Settings</Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 w-full p-4 md:p-8 space-y-8 pb-32">
        <Link href="/" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-4 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Back to Overview
      </Link>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isToday ? "Today's Log" : "Daily Log"}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          {pushingSlack && <span className="text-sm flex items-center text-zinc-500 animate-pulse"><Loader2 size={14} className="mr-1 animate-spin" /> Slack...</span>}
          {isToday && (
             <Button variant="outline" onClick={handleBackup} disabled={backingUp} className="gap-2 shadow-sm">
               {backingUp ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
               Backup to GitHub
             </Button>
          )}
        </div>
      </div>

      {/* Morning Daily Section */}
      <section className="bg-blue-50/50 dark:bg-blue-950/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900 shadow-sm transition-all">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🌅</span>
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300">Morning Daily</h2>
        </div>
        {dailyLog ? (
          editingLogId === dailyLog.id ? (
            <RichTextInput 
              id={`edit-${dailyLog.id}`}
              initialContent={dailyLog.content}
              buttonText="Save Changes"
              onSubmit={(c) => handleUpdate(dailyLog.id, c)}
              onCancel={() => setEditingLogId(null)}
              minHeight="min-h-[120px]"
            />
          ) : (
            <div className="prose dark:prose-invert prose-sm max-w-none bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border relative group">
               <div className="absolute top-4 right-4 text-blue-500 flex items-center gap-1 text-sm font-medium">
                  <CheckCircle2 size={16} /> Saved
               </div>
               <ReactMarkdown>{dailyLog.content}</ReactMarkdown>
               <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                 <Button variant="ghost" size="sm" onClick={() => setEditingLogId(dailyLog.id)} className="text-zinc-600 dark:text-zinc-400">
                   <Pencil size={14} className="mr-2" /> Edit
                 </Button>
                 <Button variant="ghost" size="sm" onClick={() => handleSave('daily', dailyLog.content)} className="text-blue-600">
                   <Send size={14} className="mr-2" /> Resend to Slack
                 </Button>
               </div>
            </div>
          )
        ) : (
            <RichTextInput 
              id="morning-daily"
              placeholder="What is your goal for this day? (e.g. [Doing] Fix bug A)"
              buttonText="Save & Push Daily"
              onSubmit={(content) => handleSave('daily', content)}
              minHeight="min-h-[120px]"
            />
        )}
      </section>

      {/* Timeline Feed */}
      <section className="space-y-6 relative pl-2 pt-4">
        <div className="absolute left-[35px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-200 via-zinc-200 to-purple-200 dark:from-blue-900 dark:via-zinc-800 dark:to-purple-900" />
        
        {simpleLogs.map(log => (
          <div key={log.id} className="flex gap-6 relative group">
             <div className="w-16 flex-shrink-0 flex flex-col items-center pt-3">
                <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-700 ring-4 ring-white dark:ring-black z-10 group-hover:bg-blue-500 transition-colors" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-mono bg-white dark:bg-black px-1">
                  {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
             </div>
             <div className="flex-1 bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 prose dark:prose-invert prose-sm max-w-none transition-all hover:shadow-md relative group/item">
                {editingLogId === log.id ? (
                  <div className="mt-1">
                    <RichTextInput 
                      id={`edit-${log.id}`}
                      initialContent={log.content}
                      buttonText="Update"
                      onSubmit={(c) => handleUpdate(log.id, c)}
                      onCancel={() => setEditingLogId(null)}
                      minHeight="min-h-[80px]"
                    />
                  </div>
                ) : (
                  <>
                    <ReactMarkdown>{log.content}</ReactMarkdown>
                    <div className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => setEditingLogId(log.id)} className="h-8 w-8 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
                        <Pencil size={14} />
                      </Button>
                    </div>
                  </>
                )}
             </div>
          </div>
        ))}

        <div className="flex gap-6 relative">
             <div className="w-16 flex-shrink-0 flex flex-col items-center pt-5">
                <div className="w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-black z-10 animate-pulse" />
             </div>
             <div className="flex-1">
               <RichTextInput 
                  id="quick-log"
                  placeholder="What are you working on? (Voice memo works too!)"
                  buttonText="Post Log"
                  onSubmit={(content) => handleSave('log', content)}
                  minHeight="min-h-[80px]"
                />
             </div>
          </div>
      </section>

      {/* Evening Summary Section */}
      <section className="bg-purple-50/50 dark:bg-purple-950/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-900 shadow-sm mt-12 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🌙</span>
          <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-300">Evening Summary</h2>
        </div>
        <p className="text-sm text-purple-600 dark:text-purple-400 mb-4 ml-8">Summarize your day here. It will be vectorized for the Knowledge Graph.</p>
        {summaryLog ? (
          editingLogId === summaryLog.id ? (
            <RichTextInput 
              id={`edit-${summaryLog.id}`}
              initialContent={summaryLog.content}
              buttonText="Save Changes"
              onSubmit={(c) => handleUpdate(summaryLog.id, c)}
              onCancel={() => setEditingLogId(null)}
              minHeight="min-h-[150px]"
            />
          ) : (
            <div className="prose dark:prose-invert prose-sm max-w-none bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border relative group">
               <div className="absolute top-4 right-4 text-purple-500 flex items-center gap-1 text-sm font-medium">
                  <CheckCircle2 size={16} /> Saved
               </div>
               <ReactMarkdown>{summaryLog.content}</ReactMarkdown>
               <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                 <Button variant="ghost" size="sm" onClick={() => setEditingLogId(summaryLog.id)} className="text-zinc-600 dark:text-zinc-400">
                   <Pencil size={14} className="mr-2" /> Edit
                 </Button>
                 <Button variant="ghost" size="sm" onClick={() => handleSave('summary', summaryLog.content)} className="text-purple-600">
                   <Send size={14} className="mr-2" /> Resend to Slack
                 </Button>
               </div>
            </div>
          )
        ) : (
            <RichTextInput 
              id="evening-summary"
              placeholder="Summarize this day's progress... (e.g. Completed Task A, blocked by B)"
              buttonText="Save Summary"
              onSubmit={(content) => handleSave('summary', content)}
              minHeight="min-h-[150px]"
            />
        )}
      </section>
      </div>
    </div>
  );
}
