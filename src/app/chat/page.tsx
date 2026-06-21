'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { chatWithLogs } from '@/app/actions/ai';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    const res = await chatWithLogs(userMessage);
    
    setMessages((prev) => [
      ...prev,
      { role: 'ai', text: res.answer || `Error: ${res.error}` }
    ]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 py-4 px-6 flex items-center gap-4 bg-white dark:bg-black">
        <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Second Brain Chat</h1>
          <p className="text-sm text-zinc-500">Ask questions about your past logs</p>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Chat with your Logs</CardTitle>
            <CardDescription>Powered by Gemini and pgvector RAG</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
            {messages.length === 0 && (
              <p className="text-zinc-500 text-center italic mt-10">
                Try asking: "What did I work on regarding the Data Pipeline project last month?"
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900' 
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                  <p className="text-sm animate-pulse">Thinking...</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t p-4">
            <form onSubmit={handleSend} className="flex w-full gap-2">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ask your second brain..." 
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                Send
              </Button>
            </form>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
