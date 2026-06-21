'use client';

import { useState, useEffect } from 'react';
import { fetchLogDays, setDailyStatus, type DailyStatus } from '@/app/actions/logs';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, MessageSquare, Plus, FileText } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HistoryOverview() {
  const [datesWithLogs, setDatesWithLogs] = useState<string[]>([]);
  const [leaveStatuses, setLeaveStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const router = useRouter();

  const load = async () => {
    const res = await fetchLogDays();
    if (res.dates) setDatesWithLogs(res.dates);
    if (res.statuses) setLeaveStatuses(res.statuses);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (val: string) => {
    if (!selectedDate) return;
    setUpdatingStatus(true);
    const dStr = selectedDate.toLocaleDateString('sv-SE');
    await setDailyStatus(dStr, val as DailyStatus);
    await load();
    setUpdatingStatus(false);
  };

  const handleOpenLog = () => {
    if (!selectedDate) return;
    const dStr = selectedDate.toLocaleDateString('sv-SE');
    router.push(`/log/${dStr}`);
  };

  if (loading) {
    return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;
  }

  const selectedDateStr = selectedDate?.toLocaleDateString('sv-SE') || '';
  const currentStatus = leaveStatuses.find(s => s.date === selectedDateStr)?.status || 'work';
  const hasLogOnSelected = datesWithLogs.includes(selectedDateStr);

  const modifiers = {
    hasLog: (date: Date) => datesWithLogs.includes(date.toLocaleDateString('sv-SE')),
    sick: (date: Date) => leaveStatuses.some(s => s.date === date.toLocaleDateString('sv-SE') && s.status === 'sick'),
    vacation: (date: Date) => leaveStatuses.some(s => s.date === date.toLocaleDateString('sv-SE') && s.status === 'vacation'),
    personal: (date: Date) => leaveStatuses.some(s => s.date === date.toLocaleDateString('sv-SE') && s.status === 'personal'),
  };

  const modifiersClassNames = {
    hasLog: "underline decoration-blue-500 decoration-2 underline-offset-4 font-bold",
    sick: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    vacation: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    personal: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  };

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

      <div className="flex-1 w-full p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Log Calendar</h1>
            <p className="text-zinc-500">Select a date to view, add logs, or manage your leave status.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Card className="flex justify-center p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="rounded-md"
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
              />
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardTitle>
                  <CardDescription>Status and Logs for this day</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Daily Status</label>
                    <div className="flex items-center gap-2">
                      <Select value={currentStatus} onValueChange={handleStatusChange} disabled={updatingStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">💼 Work / Normal</SelectItem>
                          <SelectItem value="sick">🤒 Sick Leave</SelectItem>
                          <SelectItem value="vacation">🌴 Vacation</SelectItem>
                          <SelectItem value="personal">🏠 Personal Leave</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingStatus && <Loader2 className="animate-spin text-zinc-400" size={16} />}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                    {hasLogOnSelected ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2 font-medium">
                          <FileText size={18} />
                          Logs Exist
                        </div>
                        <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mb-4">You have recorded logs for this date.</p>
                        <Button className="w-full gap-2" onClick={handleOpenLog}>
                          View Logs
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500 mb-4">No logs recorded for this date yet.</p>
                        <Button variant="outline" className="w-full gap-2" onClick={handleOpenLog}>
                          <Plus size={16} /> Add Log Entry
                        </Button>
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-zinc-500 p-4 bg-white dark:bg-zinc-950 border rounded-lg shadow-sm">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Has Logs</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 border border-red-300"></span> Sick</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-200 border border-green-300"></span> Vacation</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-200 border border-purple-300"></span> Personal</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
