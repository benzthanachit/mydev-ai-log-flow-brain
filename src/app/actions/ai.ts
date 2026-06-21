'use server';

import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function getGeminiService() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemini_api_key, slack_webhook_url')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.gemini_api_key) {
    throw new Error('Gemini API Key not configured in Settings.');
  }

  const genAI = new GoogleGenerativeAI(profile.gemini_api_key);
  return { genAI, slackWebhookUrl: profile.slack_webhook_url };
}

export async function generateStandup(markdownContent: string, imageUrls: string[] = []) {
  try {
    const { genAI } = await getGeminiService();
    // Using gemini-2.5-flash as it's fast and supports multimodal
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an AI assistant helping a developer write their Daily Standup.
Read the following daily log. The log might be messy, continuous stream of thoughts, and may contain code switching between Thai and English.
Extract the key points and format them into a clean, professional Daily Standup format:
- What I did yesterday (or earlier today)
- What I'm doing today
- Blockers/Issues (if any)

Please use the same primary language as the input (likely Thai/English mix).

Daily Log:
${markdownContent}

Image URLs present in the log: ${imageUrls.join(', ')}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { standup: response.text() };
  } catch (error: any) {
    console.error('Error generating standup:', error);
    return { error: error.message };
  }
}

export async function pushToSlack(message: string) {
  try {
    const { slackWebhookUrl } = await getGeminiService();
    if (!slackWebhookUrl) {
      throw new Error('Slack Webhook URL not configured in Settings.');
    }

    const res = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!res.ok) {
      throw new Error(`Slack API responded with ${res.status}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error pushing to Slack:', error);
    return { error: error.message };
  }
}

export async function generateEmbedding(text: string) {
  try {
    const { genAI } = await getGeminiService();
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return { embedding: result.embedding.values };
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    return { error: error.message };
  }
}

export async function chatWithLogs(userQuery: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Embed the query
    const { embedding, error: embedError } = await generateEmbedding(userQuery);
    if (embedError || !embedding) throw new Error(embedError || 'Failed to embed query');

    // 2. Search Postgres using vector similarity
    const { data: matches, error: matchError } = await supabase
      .rpc('match_logs', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 20,
        p_user_id: user.id
      });

    if (matchError) throw matchError;

    // 3. Construct context
    const contextText = matches?.map((m: any) => `Type: ${m.entry_type}\nDate: ${new Date(m.created_at).toLocaleString()}\nContent: ${m.content}`).join('\n\n') || 'No relevant past logs found.';

    // 4. Ask Gemini
    const { genAI } = await getGeminiService();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a "Second Brain" AI assistant for a developer.
Answer the user's question based on the following historical log context.
If the answer is not in the context, say you don't know based on the provided logs.

Context:
${contextText}

User Question: ${userQuery}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { answer: response.text() };

  } catch (error: any) {
    console.error('Error in chatWithLogs:', error);
    return { error: error.message };
  }
}

export async function transcribeAudio(base64AudioUrl: string) {
  try {
    const { genAI } = await getGeminiService();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const base64Data = base64AudioUrl.split(',')[1];

    const prompt = "Please transcribe the following voice memo accurately in the language it is spoken. Only output the transcription text.";
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "audio/webm",
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    return { text: response.text() };
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    return { error: error.message };
  }
}
