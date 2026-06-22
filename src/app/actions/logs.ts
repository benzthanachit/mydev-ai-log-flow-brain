'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './ai';

export type LogType = 'daily' | 'log' | 'summary';
export type DailyStatus = 'work' | 'sick' | 'vacation' | 'personal';

export async function saveLogEntry(type: LogType, content: string, dateString?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Ensure profile exists before inserting (in case they haven't visited settings yet)
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!profile) {
      await supabase.from('profiles').insert({ id: user.id, email: user.email });
    }

    const { embedding } = await generateEmbedding(content);

    const targetDate = dateString || new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local time

    const { data, error } = await supabase.from('logs').insert({
      user_id: user.id,
      entry_type: type,
      content,
      embedding: embedding || null,
      log_date: targetDate,
    }).select().single();

    if (error) throw error;
    return { success: true, log: data };
  } catch (error: any) {
    console.error('Error saving log:', error);
    return { error: error.message };
  }
}

export async function updateLogEntry(id: bigint, content: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { embedding } = await generateEmbedding(content);

    const { data, error } = await supabase.from('logs').update({
      content,
      embedding: embedding || null,
    })
    .eq('id', id)
    .eq('user_id', user.id) // security check
    .select().single();

    if (error) throw error;
    return { success: true, log: data };
  } catch (error: any) {
    console.error('Error updating log:', error);
    return { error: error.message };
  }
}

export async function fetchLogsForDate(dateString: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Query directly by log_date
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', dateString)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { logs: data };
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return { error: error.message };
  }
}

export async function fetchLogDays() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { dates: [], statuses: [] };

    // Get distinct dates from logs
    const { data: logData, error: logError } = await supabase
      .from('logs')
      .select('log_date')
      .eq('user_id', user.id);

    if (logError) throw logError;

    const uniqueDates = Array.from(new Set(logData.map(d => d.log_date)));

    // Get statuses
    const { data: statusData, error: statusError } = await supabase
      .from('daily_status')
      .select('date, status')
      .eq('user_id', user.id);

    if (statusError) throw statusError;

    return { dates: uniqueDates, statuses: statusData };
  } catch (error: any) {
    console.error('Error fetching log days:', error);
    return { error: error.message, dates: [], statuses: [] };
  }
}

export async function setDailyStatus(dateString: string, status: DailyStatus) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('daily_status').upsert({
      user_id: user.id,
      date: dateString,
      status: status
    }, { onConflict: 'user_id,date' });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error setting status:', error);
    return { error: error.message };
  }
}

export async function fetchLatestSummary(beforeDate: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('logs')
      .select('content, log_date')
      .eq('user_id', user.id)
      .eq('entry_type', 'summary')
      .lt('log_date', beforeDate)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { summary: data };
  } catch (error: any) {
    console.error('Error fetching latest summary:', error);
    return { error: error.message };
  }
}

