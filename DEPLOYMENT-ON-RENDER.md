# Deploy KABS-Annotate on Render

This guide will help you deploy the KABS-Annotate application on Render.com.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Supabase Project**: Have your Supabase project ready with credentials

## Step 1: Prepare Your Repository

### 1.1 Ensure All Files Are Committed
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 1.2 Verify Required Files
Make sure your repository contains:
- `Dockerfile`
- `render.yaml`
- `.env` (with production values)
- `package.json`

## Step 2: Configure Environment Variables

### 2.1 Supabase Credentials
You'll need these environment variables in Render:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
NODE_ENV=production
PORT=5000
```

### 2.2 Create Supabase Storage Bucket
In your Supabase dashboard:
1. Go to **Storage**
2. Create bucket named `project-files`
3. Set to **Public** access
4. Add appropriate RLS policies

## Step 3: Deploy on Render

### 3.1 Connect GitHub to Render
1. Log in to Render
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select your KABS-Annotate repository

### 3.2 Configure Web Service

#### Basic Settings:
- **Name**: `kabs-annotate`
- **Environment**: `Docker`
- **Region**: Choose nearest to your users
- **Branch**: `main`

#### Build Settings:
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `./`

#### Environment Variables:
Add all the environment variables from Step 2.1

#### Advanced Settings:
- **Health Check Path**: `/api/health`
- **Instance Type**: `Free` (or `Starter` for better performance)
- **Auto-Deploy**: Enabled

### 3.3 Create Database (Optional)
If you prefer not to use Supabase:
1. Click **"New +"** → **"PostgreSQL"**
2. Name it `kabs-annotate-db`
3. Update your `DATABASE_URL` with Render's connection string

## Step 4: Post-Deployment Setup

### 4.1 Run Database Migration
If using Supabase, run the `complete-reset.sql` script:
```sql
-- Run this in Supabase SQL Editor
-- (Content from complete-reset.sql)
```

### 4.2 Verify Deployment
1. Check the Render dashboard for deployment status
2. Visit your app URL: `https://kabs-annotate.onrender.com`
3. Test:
   - Health check: `https://kabs-annotate.onrender.com/api/health`
   - Database test: `https://kabs-annotate.onrender.com/api/db-test`
   - User signup/login
   - Project creation

## Step 5: Custom Domain (Optional)

### 5.1 Add Custom Domain
1. In Render dashboard → **Web Service** → **Custom Domains**
2. Add your domain (e.g., `app.yourdomain.com`)
3. Update DNS records as instructed

### 5.2 SSL Certificate
Render automatically provides SSL certificates for custom domains.

## Troubleshooting

### Common Issues:

#### 1. Build Fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check Render build logs

#### 2. Database Connection Errors
- Verify DATABASE_URL format
- Check Supabase credentials
- Ensure IP whitelisting if needed

#### 3. File Upload Issues
- Verify Supabase storage bucket exists
- Check file size limits (50MB max)
- Verify bucket permissions

#### 4. 500 Errors
- Check Render logs
- Test `/api/db-test` endpoint
- Verify database schema

### Debug Commands:
```bash
# Check logs in Render dashboard
# Test endpoints locally
curl https://your-app.onrender.com/api/health
curl https://your-app.onrender.com/api/db-test
```

## Performance Optimization

### 1. Upgrade Instance Type
- **Free**: 512MB RAM, shared CPU
- **Starter**: 1GB RAM, dedicated CPU
- **Standard**: 2GB RAM, dedicated CPU

### 2. Enable CDN
Render automatically provides CDN for static assets.

### 3. Database Optimization
- Use connection pooling
- Add database indexes
- Monitor query performance

## Monitoring and Maintenance

### 1. Render Dashboard
Monitor:
- CPU usage
- Memory usage
- Response times
- Error rates

### 2. Logging
Render provides built-in logging. Check:
- Application logs
- Build logs
- Error logs

### 3. Backups
- **Database**: Render automatically backs up PostgreSQL
- **Supabase**: Configure backups in Supabase dashboard
- **Files**: Supabase Storage has built-in versioning

## Security Considerations

### 1. Environment Variables
- Never commit secrets to Git
- Use Render's encrypted environment variables
- Rotate keys regularly

### 2. Database Security
- Use strong passwords
- Enable SSL connections
- Implement proper RLS policies in Supabase

### 3. API Security
- Validate all inputs
- Implement rate limiting
- Use HTTPS everywhere

## Scaling

### 1. Vertical Scaling
Upgrade to larger instance types in Render dashboard.

### 2. Horizontal Scaling
- Add load balancer
- Deploy multiple instances
- Use Redis for session storage

### 3. Database Scaling
- Read replicas for Supabase
- Connection pooling
- Query optimization

## Cost Management

### Render Pricing (as of 2024):
- **Free**: $0/month (limited hours)
- **Starter**: $7/month
- **Standard**: $25/month
- **Pro**: $100/month

### Cost Optimization Tips:
- Use free tier for development
- Monitor usage closely
- Scale down during off-hours
- Optimize database queries

## Support

### Render Support:
- Documentation: [render.com/docs](https://render.com/docs)
- Status page: [status.render.com](https://status.render.com)
- Support: support@render.com

### Additional Resources:
- Docker documentation
- Supabase documentation
- Node.js best practices

---

**Deployment Checklist:**

- [ ] Repository pushed to GitHub
- [ ] Environment variables configured
- [ ] Supabase storage bucket created
- [ ] Database schema applied
- [ ] Render web service created
- [ ] Health check passing
- [ ] User authentication working
- [ ] Project creation working
- [ ] File uploads working
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Backup strategy implemented

Your KABS-Annotate application should now be successfully running on Render!
