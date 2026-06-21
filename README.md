# 🚀 Log-Flow

Log-Flow is a Continuous-stream journaling application that acts as your AI Standup Generator and a "Second Brain". It seamlessly synchronizes your daily logs with an Obsidian Vault stored on GitHub.

## 🛠️ Tech Stack
- Next.js 16 (App Router)
- Tailwind CSS & shadcn/ui
- TipTap (Markdown Editor)
- Supabase (Auth, PostgreSQL, pgvector, Storage)
- Gemini 1.5 Flash & text-embedding-004 (AI & RAG)
- Octokit (GitHub API)

## 📦 Setup Instructions

### 1. Database Setup (Supabase)
1. Create a new project on [Supabase](https://supabase.com/).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/schema.sql` from this repository, copy all the SQL code, and run it. This will create:
   - `profiles` table (for API keys)
   - `documents` table (for vector embeddings)
   - `images` storage bucket
   - Necessary Row Level Security (RLS) policies.
4. Go to **Authentication > Providers > Email** and turn **OFF** "Confirm email" if you want users to log in immediately without verifying their email.

### 2. Environment Variables
Copy `.env.example` to `.env.local` (or create `.env.local` directly) and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start the Application
Run the following commands to install dependencies and start the Next.js dev server:
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`.

---

## ⚙️ Configuration (Inside the App)

Once you log in to Log-Flow, you need to configure your settings by clicking the **Settings (Gear Icon)** in the top right corner.

### GitHub "Obsidian-First" Vault
To sync your logs to GitHub (so you can pull them down into Obsidian):
1. **Create a Repository:** Go to GitHub and create a new Private repository (e.g., `my-log-vault`).
2. **Repository Name:** In Log-Flow settings, enter the repo name in the format `username/repo` (e.g., `octocat/my-log-vault`).
3. **Generate PAT:** 
   - Go to GitHub -> Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic).
   - Generate a new token with the **`repo`** scope (Full control of private repositories).
   - Paste this token into the **GitHub PAT** field in Log-Flow settings.

### AI & Slack Integrations
- **Gemini API Key:** Go to Google AI Studio to get a Gemini API key. This powers the Voice Memo, AI Standup, and Second Brain chat features.
- **Slack Webhook URL:** If you want to push standups to Slack, create an Incoming Webhook in your Slack workspace and paste the URL here.

---

## 📝 Usage

- **Local-First Editor:** Just start typing. Everything is saved locally to your browser instantly.
- **Voice Memo:** Click the Mic button to record your voice. It will transcribe it directly into the editor using Gemini.
- **Sync to GitHub:** Clicking this will push your daily log (`YYYY-MM-DD.md`) to your configured GitHub repo. It also automatically splits your log and creates vector embeddings in Supabase for your Second Brain.
- **AI Standup:** Click "Generate Standup" to let Gemini summarize your day. You can review and edit it before pushing it to Slack.
- **Second Brain Chat:** Navigate to the `/chat` page (via the back arrow in the header if on settings, or direct link) to ask questions about your past logs.
