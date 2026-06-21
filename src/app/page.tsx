'use client';

import { useState, useEffect } from 'react';
import { fetchLogDays } from '@/app/actions/logs';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Plus, Settings, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function HistoryOverview() {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchLogDays();
      if (res.dates) {
        setDates(res.dates);
      }
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('sv-SE');

  if (loading) {
    return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;
  }

  return (
    <div className="w-full flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 py-4 px-6 flex justify-between items-center bg-white dark:bg-black">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight hover:underline">Log-Flow</Link>
          <span className="text-zinc-500">/ Overview</span>
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

      <div className="flex-1 w-full p-4 md:p-8 space-y-8">
        <div className="flex justify-between items-center mb-8 border-b pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Log History</h1>
          <p className="text-zinc-500">Overview of your daily records.</p>
        </div>
        <Link href={`/log/${today}`}>
          <Button className="gap-2 shadow-sm">
            <Plus size={16} />
            Write Today's Log
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {dates.length === 0 ? (
          <div className="col-span-full p-10 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500">
            No logs found. Start by writing your first log today!
          </div>
        ) : (
          dates.map(date => (
            <Link key={date} href={`/log/${date}`}>
              <div className="p-5 rounded-xl border bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer group flex items-center justify-between">
                <div>
                  <h3 className="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono mt-1">{date}</p>
                </div>
                <Calendar className="text-zinc-300 group-hover:text-blue-400 transition-colors" size={24} />
              </div>
            </Link>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
