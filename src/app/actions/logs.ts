'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './ai';

export type LogType = 'daily' | 'log' | 'summary';

export async function saveLogEntry(type: LogType, content: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { embedding } = await generateEmbedding(content);

    const { data, error } = await supabase.from('logs').insert({
      user_id: user.id,
      entry_type: type,
      content,
      embedding: embedding || null,
    }).select().single();

    if (error) throw error;
    return { success: true, log: data };
  } catch (error: any) {
    console.error('Error saving log:', error);
    return { error: error.message };
  }
}

export async function fetchLogsForDate(dateString: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Parse the given YYYY-MM-DD
    const startOfDay = new Date(dateString);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
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
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('logs')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Extract unique YYYY-MM-DD local dates
    const uniqueDates = new Set<string>();
    data.forEach(log => {
      const d = new Date(log.created_at);
      uniqueDates.add(d.toLocaleDateString('sv-SE')); // YYYY-MM-DD
    });

    return { dates: Array.from(uniqueDates) };
  } catch (error: any) {
    console.error('Error fetching log days:', error);
    return { error: error.message };
  }
}
