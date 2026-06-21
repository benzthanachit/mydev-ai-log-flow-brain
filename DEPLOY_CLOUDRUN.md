# Deploying Next.js to Google Cloud Run (from Macbook M4)

Since you are using a **Macbook M4 (Apple Silicon / ARM64 architecture)**, you have two main choices when building your Docker image for Google Cloud Run:

1. **(Recommended)** Build as `linux/arm64` locally, and configure your Cloud Run service to use ARM (which is generally cheaper and faster).
2. Build as `linux/amd64` using `docker buildx` (emulation), which can be very slow to build locally.

This guide uses the **Recommended (ARM64)** approach.

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

## 🐳 Step 3: Build Docker Image บน Mac M4 (ARM64)

ด้วยชิป M4 เราจะ Build Image บน ARM64 ซึ่ง Build ได้เร็วปรี๊ดด:

```bash
# ตั้งค่าตัวแปร (เพื่อความง่ายในการก็อปวาง)
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-southeast1
export REPO=logflow-repo
export IMAGE_NAME=logflow-app
export IMAGE_TAG=v1
export IMAGE_URL=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE_NAME:$IMAGE_TAG

# สั่ง Build Image ด้วยสถาปัตยกรรม arm64 
docker build --platform linux/arm64 -t $IMAGE_URL .
```

> **Note:** โค้ดในส่วนนี้ได้เตรียม `Dockerfile`, `.dockerignore` และตั้งค่า `output: "standalone"` ใน `next.config.ts` เพื่อให้ Image มีขนาดเล็กลงเรียบร้อยแล้วครับ

---

## 🚀 Step 4: Push & Deploy ขึ้น Cloud Run

```bash
# 1. ส่ง Image ขึ้น Artifact Registry
docker push $IMAGE_URL

# 2. Deploy ขึ้น Cloud Run
# เราจะบังคับใช้ CPU แบบ ARM (--execution-environment gen2)
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
