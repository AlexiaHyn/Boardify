# Deploy Frontend to Vercel

## Prerequisites

- ✅ Backend deployed and accessible via public URL (Heroku, Railway, Render, etc.)
- ✅ Backend supports CORS (already configured in `app/main.py`)
- ✅ Backend supports WebSocket connections

---

## Option 1: Deploy via Vercel Dashboard (Easiest)

### Step 1: Update Production Environment Variables

Edit `frontend/.env.production` with your backend URL:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.herokuapp.com
NEXT_PUBLIC_WS_URL=wss://your-backend-url.herokuapp.com
```

**Important:** Use `https://` for API and `wss://` for WebSocket!

### Step 2: Push to GitHub

```bash
# From project root
git add .
git commit -m "Prepare frontend for Vercel deployment"
git push
```

### Step 3: Deploy on Vercel

1. Go to https://vercel.com
2. Click **"Add New..." → "Project"**
3. **Import Git Repository**:
   - Connect your GitHub account (if not already)
   - Select your repository: `Boardify`
4. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: Click **"Edit"** → Set to `game-engine/frontend`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)
5. **Environment Variables**:
   - Click **"Environment Variables"**
   - Add variable:
     - Name: `NEXT_PUBLIC_API_URL`
     - Value: `https://your-backend-url.herokuapp.com`
   - Add variable:
     - Name: `NEXT_PUBLIC_WS_URL`
     - Value: `wss://your-backend-url.herokuapp.com`
6. Click **"Deploy"**

### Step 4: Wait for Deployment

Vercel will:
- ✅ Install dependencies
- ✅ Build your Next.js app
- ✅ Deploy to global CDN
- ✅ Provide a production URL: `https://boardify-xxx.vercel.app`

**Deployment takes ~2-3 minutes.**

---

## Option 2: Deploy via Vercel CLI (Advanced)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This opens a browser for authentication.

### Step 3: Deploy

```bash
cd game-engine/frontend

# First deployment (interactive)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (Your team)
# - Link to existing project? No
# - Project name? boardify-frontend
# - Directory? ./ (current)
# - Override settings? No

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Paste your backend URL: https://your-backend.herokuapp.com

vercel env add NEXT_PUBLIC_WS_URL production
# Paste your WebSocket URL: wss://your-backend.herokuapp.com

# Deploy to production
vercel --prod
```

### Step 4: Get Your URL

After deployment, Vercel shows:
```
✅ Production: https://boardify-frontend.vercel.app
```

---

## Option 3: Auto-Deploy from GitHub (Recommended)

Once you've deployed via Option 1 or 2, Vercel automatically redeploys when you push to GitHub.

**Enable Auto-Deploy:**

1. In Vercel dashboard → Your project
2. Settings → Git
3. Production Branch: `main` (or your default branch)
4. **Automatic Deployments**: Enabled ✅

**Now whenever you push to main:**
```bash
git push origin main
```
Vercel automatically rebuilds and deploys! 🚀

---

## Step 5: Update Backend CORS (Important!)

Your backend currently allows all origins. For production, restrict to your Vercel domain:

Edit `game-engine/backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",  # Your Vercel URL
        "http://localhost:3000",        # Keep for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Then redeploy your backend.**

---

## Testing Your Deployment

### 1. Test Frontend Loads

Visit: `https://your-app.vercel.app`

You should see the Boardify landing page.

### 2. Test Backend Connection

1. Open browser console (F12)
2. Go to your Vercel app
3. Try creating a game room
4. Check Network tab for API calls to your backend

### 3. Test WebSocket

1. Create a room
2. Join with multiple players (open in incognito/different browser)
3. Play a card
4. Verify real-time updates work

---

## Troubleshooting

### "Failed to fetch" or Network Errors

**Cause:** Frontend can't reach backend.

**Solutions:**
1. Check backend URL in Vercel environment variables
2. Ensure backend is running and accessible
3. Test backend directly: `curl https://your-backend.herokuapp.com/health`
4. Check CORS settings in backend

### WebSocket Connection Failed

**Cause:** Wrong WebSocket URL or backend doesn't support WebSockets.

**Solutions:**
1. Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
2. Test WebSocket manually: Use [WebSocket King](https://websocketking.com/) to connect to `wss://your-backend/ws/test/test`
3. Verify backend platform supports WebSockets (Heroku, Railway, Render all do)

### "Environment Variables Not Working"

**Cause:** Environment variables must start with `NEXT_PUBLIC_` to be exposed to browser.

**Solution:**
- ✅ Correct: `NEXT_PUBLIC_API_URL`
- ❌ Wrong: `API_URL`

After changing env vars in Vercel, **redeploy** for changes to take effect.

### Build Fails on Vercel

**Cause:** Missing dependencies or build errors.

**Solutions:**
1. Check Vercel build logs
2. Test build locally: `npm run build`
3. Ensure `package.json` has all dependencies
4. Check Node.js version compatibility

---

## Environment Variables Reference

| Variable | Example | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | ✅ Yes |
| `NEXT_PUBLIC_WS_URL` | `wss://api.example.com` | ✅ Yes |

**Note:** Variables starting with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets here!

---

## Custom Domain (Optional)

### Add Your Own Domain

1. Vercel Dashboard → Your Project → Settings → Domains
2. Add domain: `boardify.yourdomain.com`
3. Update DNS records (Vercel provides instructions)
4. Vercel automatically provisions SSL certificate

---

## Performance Optimization

Vercel automatically handles:
- ✅ Global CDN
- ✅ Image optimization
- ✅ Automatic caching
- ✅ Compression
- ✅ SSL certificates

**No configuration needed!** Next.js + Vercel is optimized out of the box.

---

## Monitoring

### View Deployment Logs

Vercel Dashboard → Your Project → Deployments → Click deployment → View Logs

### View Analytics

Vercel Dashboard → Your Project → Analytics (Pro plan required)

### Real-Time Logs

```bash
vercel logs [deployment-url]
```

---

## Cost

**Vercel Hobby (Free) Tier:**
- ✅ Unlimited deployments
- ✅ Unlimited bandwidth
- ✅ 100GB-hours compute
- ✅ Automatic SSL
- ✅ Custom domains

**Perfect for hackathons and personal projects!**

---

## Quick Reference Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# View environment variables
vercel env ls

# Pull environment variables locally
vercel env pull
```

---

## Summary Checklist

- [ ] Backend deployed and accessible
- [ ] `.env.production` created with backend URLs
- [ ] Code pushed to GitHub
- [ ] Project created on Vercel
- [ ] Root directory set to `game-engine/frontend`
- [ ] Environment variables added in Vercel
- [ ] Deployment successful
- [ ] Frontend loads correctly
- [ ] Backend API calls work
- [ ] WebSocket connections work
- [ ] CORS updated in backend
- [ ] Backend redeployed with new CORS settings

---

## Next Steps

Once deployed:

1. **Share your app**: `https://your-app.vercel.app`
2. **Auto-deploy**: Push to GitHub → Auto-deploy to Vercel
3. **Monitor**: Check Vercel dashboard for logs/errors
4. **Iterate**: Make changes locally → Push → Auto-deploy

**You're ready for TreeHacks! 🎉**
