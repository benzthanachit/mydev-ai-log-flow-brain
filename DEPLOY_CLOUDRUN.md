# Deploying Next.js to Google Cloud Run (from Macbook M4)

Since you are using a **Macbook M4 (Apple Silicon / ARM64 architecture)**, you must build your Docker image for the **`linux/amd64`** architecture. Google Cloud Run requires container images to be compatible with `amd64/linux` to run properly.

This guide uses the **`linux/amd64`** build approach.

---

## 🛠️ Step 1: Pre-requisites

1. คุณต้องมีบัญชี **Google Cloud Platform (GCP)** และสร้าง Project ไว้แล้ว
2. ติดตั้ง **[Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)** ในเครื่อง
3. ติดตั้ง **Docker Desktop** สำหรับ Mac M4
4. เปิดการใช้งาน API ที่จำเป็นบน GCP:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

---

## 📦 Step 2: สร้าง Artifact Registry (ที่เก็บ Docker Image)

Cloud Run จะดึง Image จาก Artifact Registry ให้สร้าง Repository สำหรับเก็บ Image ก่อน:

```bash
# 1. Login เข้า Google Cloud
gcloud auth login

# 2. ตั้งค่า Project ปัจจุบัน (เปลี่ยน PROJECT_ID เป็นของคุณ)
gcloud config set project YOUR_PROJECT_ID

# 3. สร้าง Repository (ชื่อ logflow-repo) ใน region asia-southeast1 (สิงคโปร์)
gcloud artifacts repositories create logflow-repo \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="Docker repository for Log Flow app"

# 4. อนุญาตให้ Docker ในเครื่อง ส่ง (Push) Image ไปที่ Google Cloud ได้
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

---

## 🐳 Step 3: Build Docker Image บน Mac M4 (AMD64)

ด้วยชิป M4 เราจะ Build Image แบบ `linux/amd64` (ผ่าน emulation) เพื่อให้สามารถรันบน Cloud Run ได้:

```bash
# ตั้งค่าตัวแปร (เพื่อความง่ายในการก็อปวาง)
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-southeast1
export REPO=logflow-repo
export IMAGE_NAME=logflow-app
export IMAGE_TAG=v1
export IMAGE_URL=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE_NAME:$IMAGE_TAG

# ดึงค่าจาก .env.local มาตั้งเป็นตัวแปรแวดล้อม
export NEXT_PUBLIC_SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d '=' -f2)

# สั่ง Build Image ด้วยสถาปัตยกรรม amd64 โดยส่งผ่านตัวแปร Supabase เข้าไปด้วย
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t $IMAGE_URL .
```

> **Note:** โค้ดในส่วนนี้ได้เตรียม `Dockerfile`, `.dockerignore` และตั้งค่า `output: "standalone"` ใน `next.config.ts` เพื่อให้ Image มีขนาดเล็กลงเรียบร้อยแล้วครับ

---

## 🚀 Step 4: Push & Deploy ขึ้น Cloud Run

```bash
# 1. ส่ง Image ขึ้น Artifact Registry
docker push $IMAGE_URL

# 2. Deploy ขึ้น Cloud Run
# เราจะเลือกใช้ Execution Environment Gen 2 (--execution-environment gen2)
# และห้ามลืมใส่ตัวแปร Environment Variables ของคุณ (Supabase) ด้วย!
gcloud run deploy logflow-service \
  --image=$IMAGE_URL \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --execution-environment=gen2 \
  --cpu=1 \
  --memory=512Mi \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY"
```

> ⚠️ **คำเตือน Environment Variables**: ในคำสั่ง `deploy` ด้านบน ให้เปลี่ยนค่า `YOUR_SUPABASE_URL` และ `YOUR_SUPABASE_ANON_KEY` ให้ตรงกับความจริง หรือถ้ามีตัวแปรอื่นๆ ใน `.env.local` ให้นำมาต่อท้ายใส่ใน `--set-env-vars` ให้หมดครับ

---

## 🎉 สรุปเมื่อ Deploy สำเร็จ

เมื่อคำสั่งรันเสร็จสิ้น `gcloud` จะปริ้น URL ของเว็บคุณออกมา เช่น `https://logflow-service-xxxxx.a.run.app`

คุณสามารถเอา URL นี้ไปเปิดในเบราว์เซอร์ และใช้งาน **Log-Flow** ของคุณบน Cloud ได้เลยครับ!
