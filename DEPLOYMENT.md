# Digital Ocean Deployment Guide for Primate Prime 🍌🚀

This guide walks you through deploying Primate Prime to Digital Ocean with automated GitHub deployments.

## Prerequisites

- Digital Ocean account
- GitHub repository for your bot
- Domain name (optional)

## Step 1: Create a Digital Ocean Droplet

1. **Log into Digital Ocean** and click "Create Droplet"

2. **Choose an image**: Ubuntu 22.04 LTS

3. **Choose a plan**:
   - Basic shared CPU
   - Regular SSD
   - $6/month (1GB RAM, 1 CPU) is enough for a Discord bot

4. **Choose datacenter**: Pick one close to your Discord server region

5. **Authentication**:
   - Choose SSH keys (recommended)
   - Or use password (less secure)

6. **Finalize**:
   - Choose a hostname like `primate-prime-bot`
   - Click "Create Droplet"

## Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

### 2.1 Create a Non-Root User

```bash
# Create user
adduser botuser

# Grant sudo privileges
usermod -aG sudo botuser

# Switch to new user
su - botuser
```

### 2.2 Install Required Software

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Yarn
sudo npm install -g yarn

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Install nginx (optional, for future web dashboard)
sudo apt install nginx -y
```

### 2.3 Setup Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS (if using nginx)
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable
```

## Step 3: Setup the Bot Application

### 3.1 Clone Repository

```bash
# Create app directory
sudo mkdir -p /var/www/primate-prime
sudo chown $USER:$USER /var/www/primate-prime

# Clone your repository
cd /var/www
git clone https://github.com/yourusername/primate-prime.git
cd primate-prime
```

### 3.2 Setup Environment

```bash
# Copy and edit environment file
cp .env.example .env
nano .env  # Add your actual tokens and keys
```

### 3.3 Initial Build and Test

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Test run
yarn start
# Press Ctrl+C to stop after confirming it works
```

### 3.4 Setup PM2

```bash
# Start with PM2
pm2 start dist/index.js --name primate-prime --node-args="--loader ./dist/resolve-ts-paths-loader.mjs"

# Save PM2 config
pm2 save

# Setup PM2 startup on reboot
pm2 startup
# Follow the command it gives you

# Check status
pm2 status
pm2 logs primate-prime
```

## Step 4: Setup GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions

Add these secrets:

1. **DO_HOST**: Your droplet's IP address (e.g., `167.99.123.45`)

2. **DO_USERNAME**: The username on your droplet (e.g., `botuser`)

3. **DO_PORT**: SSH port (usually `22`)

4. **DO_APP_PATH**: Path to your app (e.g., `/var/www/primate-prime`)

5. **DO_SSH_KEY**: Your private SSH key
   ```bash
   # On your local machine, generate if you don't have one:
   ssh-keygen -t ed25519 -C "github-actions"

   # Copy the private key content:
   cat ~/.ssh/id_ed25519
   # Copy ALL content including BEGIN and END lines
   ```

   Then on your droplet:
   ```bash
   # Add the public key to authorized_keys
   echo "your-public-key-content" >> ~/.ssh/authorized_keys
   ```

## Step 5: Setup Deployment Key on Droplet

On your droplet, generate a deploy key for GitHub:

```bash
# Generate SSH key for GitHub
ssh-keygen -t ed25519 -C "primate-prime-deploy" -f ~/.ssh/github_deploy -N ""

# Add to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_deploy

# Get the public key
cat ~/.ssh/github_deploy.pub
```

Add this public key to your GitHub repository:
1. Go to Repository Settings → Deploy keys
2. Add deploy key with the public key content
3. Allow write access if needed

Configure git to use this key:
```bash
# On droplet
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  StrictHostKeyChecking no
EOF

chmod 600 ~/.ssh/config
```

## Step 6: Environment Variables Security

Create a secure .env file on the droplet:

```bash
# Create env file with restricted permissions
touch /var/www/primate-prime/.env
chmod 600 /var/www/primate-prime/.env

# Edit with your actual values
nano /var/www/primate-prime/.env
```

## Step 7: Test Deployment

1. Make a small change to your README.md
2. Commit and push to main branch
3. Watch GitHub Actions run
4. Check your droplet:
   ```bash
   pm2 logs primate-prime
   pm2 status
   ```

## Monitoring and Maintenance

### View Logs
```bash
# Real-time logs
pm2 logs primate-prime

# Last 100 lines
pm2 logs primate-prime --lines 100
```

### Restart Bot
```bash
pm2 restart primate-prime
```

### Update Manually
```bash
cd /var/www/primate-prime
git pull
yarn install
yarn build
pm2 restart primate-prime
```

### Monitor Resources
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

## Troubleshooting

### Bot Won't Start
```bash
# Check logs
pm2 logs primate-prime --err

# Check if port is in use
sudo lsof -i -P -n

# Verify environment variables
pm2 env primate-prime
```

### GitHub Actions Failing
1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Test SSH connection manually:
   ```bash
   ssh -i path/to/key botuser@your-ip -p 22
   ```

### PM2 Issues
```bash
# Reset PM2
pm2 kill
pm2 start dist/index.js --name primate-prime --node-args="--loader ./dist/resolve-ts-paths-loader.mjs"
pm2 save
```

## Security Best Practices

1. **Use SSH keys** instead of passwords
2. **Keep .env file secure** with proper permissions
3. **Regular updates**:
   ```bash
   sudo apt update && sudo apt upgrade
   ```
4. **Use firewall** (ufw)
5. **Monitor logs** regularly
6. **Backup your .env** file securely

## Optional Enhancements

### Setup Nginx Reverse Proxy (for future web dashboard)
```bash
sudo nano /etc/nginx/sites-available/primate-prime

# Add configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/primate-prime /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl reload nginx
```

### Setup SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Costs

- **Droplet**: $6/month (Basic 1GB RAM)
- **Domain**: $10-15/year (optional)
- **Total**: ~$6-8/month

## 🍌 APE DEPLOYED!

Your Primate Prime bot should now automatically deploy whenever you push to the main branch!