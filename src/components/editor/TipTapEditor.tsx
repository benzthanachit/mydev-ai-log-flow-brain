'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useState, useRef } from 'react';
import { useLocalSync } from '@/hooks/useLocalSync';
import { fetchLogFile, commitLogFile } from '@/app/actions/github';
import { Button } from '@/components/ui/button';
import { generateStandup, pushToSlack, transcribeAudio } from '@/app/actions/ai';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';
import { type Editor } from '@tiptap/react';

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  const toggleBtnClass = (isActive: boolean) => 
    `p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isActive ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-zinc-50 dark:bg-zinc-900 rounded-t-md border-zinc-200 dark:border-zinc-800">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toggleBtnClass(editor.isActive('bold'))} title="Bold">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toggleBtnClass(editor.isActive('italic'))} title="Italic">
        <Italic size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={toggleBtnClass(editor.isActive('strike'))} title="Strikethrough">
        <Strikethrough size={16} />
      </button>
      
      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center" />

      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1">
        <Heading1 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2">
        <Heading2 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3">
        <Heading3 size={16} />
      </button>

      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center" />

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toggleBtnClass(editor.isActive('bulletList'))} title="Bullet List">
        <List size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toggleBtnClass(editor.isActive('orderedList'))} title="Ordered List">
        <ListOrdered size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toggleBtnClass(editor.isActive('blockquote'))} title="Quote">
        <Quote size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toggleBtnClass(editor.isActive('codeBlock'))} title="Code Block">
        <Code size={16} />
      </button>
    </div>
  );
};

interface TipTapEditorProps {
  documentId: string;
}

export function TipTapEditor({ documentId }: TipTapEditorProps) {
  const { content, saveContent } = useLocalSync(documentId, '');
  const [githubSha, setGithubSha] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [standupModalOpen, setStandupModalOpen] = useState(false);
  const [standupDraft, setStandupDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const supabase = createClient();

  const handleImageUpload = async (file: File) => {
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, compressedFile);

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);
        
      if (editor) {
        editor.chain().focus().setImage({ src: publicUrl }).run();
      }
    } catch (err: any) {
      alert(`Image upload failed: ${err.message}`);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your log here... type "/" for commands',
      }),
      Image,
      Markdown,
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg focus:outline-none w-full max-w-none h-full text-black dark:text-white',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.indexOf('image') === 0) {
              const file = item.getAsFile();
              if (file) {
                handleImageUpload(file);
                return true;
              }
            }
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      saveContent(markdown);
    },
  });

  useEffect(() => {
    async function loadFromGithub() {
      if (!editor) return;
      setSyncing(true);
      setConfigError(null);
      const res = await fetchLogFile(documentId);
      
      if (res && res.error) {
        if (res.error.includes('GitHub settings not configured')) {
          setConfigError('GitHub is not connected. Please configure your PAT and Repository in Settings.');
        } else {
          console.error("Github Load Error:", res.error);
        }
      } else if (res && res.content) {
        if (!content || content.length < 5) {
          editor.commands.setContent(res.content, false as any);
          saveContent(res.content);
        }
        setGithubSha(res.sha || null);
      }
      setSyncing(false);
    }
    loadFromGithub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, editor]);

  const handleCommit = async () => {
    if (!editor) return;
    setSyncing(true);
    const markdown = (editor.storage as any).markdown.getMarkdown();
    const res = await commitLogFile(documentId, markdown, githubSha || undefined);
    if (res.success) {
      setGithubSha(res.sha || null);
      alert('Synced to GitHub successfully!');
    } else {
      alert(`Error syncing: ${res.error}`);
    }
    setSyncing(false);
  };

  const handleGenerateStandup = async () => {
    if (!editor) return;
    setGenerating(true);
    setStandupModalOpen(true);
    const markdown = (editor.storage as any).markdown.getMarkdown();
    const res = await generateStandup(markdown);
    if (res.standup) {
      setStandupDraft(res.standup);
    } else {
      setStandupDraft(`Error: ${res.error}`);
    }
    setGenerating(false);
  };

  const handlePushSlack = async () => {
    setGenerating(true);
    const res = await pushToSlack(standupDraft);
    if (res.success) {
      alert('Pushed to Slack successfully!');
      setStandupModalOpen(false);
    } else {
      alert(`Error: ${res.error}`);
    }
    setGenerating(false);
  };

  const handleVoiceMemo = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        const audioChunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setGenerating(true);
            const res = await transcribeAudio(base64Audio);
            if (res.text && editor) {
              editor.commands.insertContent(res.text);
            } else {
              alert('Error transcribing audio: ' + res.error);
            }
            setGenerating(false);
          };
        };
        
        mediaRecorder.start();
        setRecording(true);
      } catch (err) {
        alert('Microphone permission denied or not available.');
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      {configError && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 p-3 rounded-md text-sm flex justify-between items-center">
          <span>{configError}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <Button 
          variant={recording ? "destructive" : "outline"} 
          onClick={handleVoiceMemo}
          className="gap-2"
        >
          {recording ? <MicOff size={16} /> : <Mic size={16} />}
          {recording ? 'Stop Recording' : 'Voice Memo'}
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCommit} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync to GitHub'}
          </Button>
          <Button onClick={handleGenerateStandup} disabled={generating}>
            ✨ Generate Standup
          </Button>
        </div>
      </div>
      
      <div className="border rounded-md shadow-sm bg-white dark:bg-zinc-950 flex flex-col relative overflow-hidden">
        <MenuBar editor={editor} />
        
        <div className="resize-y overflow-auto min-h-[400px] p-4 relative">
          {(generating || syncing) && (
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10 rounded-md">
              <span className="animate-pulse font-semibold">Processing...</span>
            </div>
          )}
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      <Dialog open={standupModalOpen} onOpenChange={setStandupModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Standup</DialogTitle>
            <DialogDescription>Review and edit your AI-generated standup before pushing to Slack.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {generating && !standupDraft ? (
              <p className="animate-pulse">Generating your standup...</p>
            ) : (
              <Textarea 
                value={standupDraft} 
                onChange={(e) => setStandupDraft(e.target.value)}
                className="min-h-[300px]"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStandupModalOpen(false)}>Cancel</Button>
            <Button onClick={handlePushSlack} disabled={generating || !standupDraft}>Push to Slack</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
