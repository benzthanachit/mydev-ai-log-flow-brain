'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';
import { transcribeAudio } from '@/app/actions/ai';
import { useLocalSync } from '@/hooks/useLocalSync';

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  const toggleBtnClass = (isActive: boolean) => 
    `p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isActive ? 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-zinc-50 dark:bg-zinc-900 rounded-t-md border-zinc-200 dark:border-zinc-800">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toggleBtnClass(editor.isActive('bold'))} title="Bold"><Bold size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toggleBtnClass(editor.isActive('italic'))} title="Italic"><Italic size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={toggleBtnClass(editor.isActive('strike'))} title="Strikethrough"><Strikethrough size={16} /></button>
      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1"><Heading1 size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2"><Heading2 size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3"><Heading3 size={16} /></button>
      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={toggleBtnClass(editor.isActive('bulletList'))} title="Bullet List"><List size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toggleBtnClass(editor.isActive('orderedList'))} title="Ordered List"><ListOrdered size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toggleBtnClass(editor.isActive('blockquote'))} title="Quote"><Quote size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toggleBtnClass(editor.isActive('codeBlock'))} title="Code Block"><Code size={16} /></button>
    </div>
  );
};

interface RichTextInputProps {
  id: string;
  placeholder?: string;
  buttonText: string;
  onSubmit: (content: string) => Promise<void>;
  minHeight?: string;
  initialContent?: string;
  onCancel?: () => void;
}

export function RichTextInput({ id, placeholder = 'Type here...', buttonText, onSubmit, minHeight = 'min-h-[150px]', initialContent, onCancel }: RichTextInputProps) {
  const { content, saveContent } = useLocalSync(id, initialContent || '');
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const supabase = createClient();

  const handleImageUpload = async (file: File) => {
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { error } = await supabase.storage.from('images').upload(fileName, compressedFile);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
      if (editor) editor.chain().focus().setImage({ src: publicUrl }).run();
    } catch (err: any) {
      alert(`Image upload failed: ${err.message}`);
    }
  };

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder }), Image, Markdown],
    content,
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose focus:outline-none w-full max-w-none text-black dark:text-white ${minHeight}`,
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
      saveContent((editor.storage as any).markdown.getMarkdown());
    },
  });

  const handleSubmit = async () => {
    if (!editor) return;
    const markdown = (editor.storage as any).markdown.getMarkdown();
    if (!markdown.trim()) return;
    
    setSubmitting(true);
    await onSubmit(markdown);
    editor.commands.clearContent(true);
    saveContent(''); // clear local storage
    setSubmitting(false);
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
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setProcessingAudio(true);
            const res = await transcribeAudio(base64Audio);
            if (res.text && editor) {
              editor.commands.insertContent(`\n🎙️ *Voice Memo:* ${res.text}\n`);
            } else {
              alert('Error transcribing audio: ' + res.error);
            }
            setProcessingAudio(false);
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
    <div className="border rounded-md shadow-sm bg-white dark:bg-zinc-950 flex flex-col relative focus-within:ring-2 ring-zinc-900 dark:ring-zinc-100 transition-all">
      <MenuBar editor={editor} />
      <div className="p-3 relative">
         {(submitting || processingAudio) && (
            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10 rounded-md">
              <span className="animate-pulse font-semibold">{submitting ? 'Saving...' : 'Transcribing...'}</span>
            </div>
         )}
         <EditorContent editor={editor} />
      </div>
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
        <Button 
          variant={recording ? "destructive" : "ghost"} 
          size="sm"
          onClick={handleVoiceMemo}
          className="gap-2 text-xs"
        >
          {recording ? <MicOff size={14} /> : <Mic size={14} />}
          {recording ? 'Stop Recording' : 'Voice Memo'}
        </Button>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel} disabled={submitting || processingAudio}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={submitting || processingAudio}>
            {submitting ? 'Saving...' : buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
