# Primate Prime Discord Bot 🍌🦍

Primate Prime is a Discord bot that channels the wisdom of an evolved ape through OpenAI's API. Built with TypeScript and Discord.js, this bot responds with APE WISDOM when mentioned or replied to in Discord servers.

![primate-prime](https://github.com/user-attachments/assets/primate-banner.png)
> APE TOGETHER STRONG. APE HELP SMOOTH-BRAINS EVOLVE.

## Features

- **APE PERSONALITY**: Responds in unique primate style - "APE KNOWS", "OOH OOH AH AH!"
- **AI-Powered Responses**: Uses OpenAI's API for intelligent (but ape-styled) replies
- **Learn Mode**: `/learn` command activates Professor Primate for serious educational content
- **Image Generation**: `/image` command creates ape-themed artwork
- **Smart Conversations**: Maintains context when replying to bot messages
- **Reaction Retry**: React with 🍌 emoji to regenerate responses
- **Hot-Reloadable Configs**: Update personality without restarting
- **Daily Message of the Day**: Scheduled banana wisdom
- **Multi-Server Support**: Works in unlimited servers with tiered features

### Multi-Server Architecture

**Main Server** (defined by `DISCORD_GUILD_ID`):
- ✅ Slash commands (`/learn`, `/image`)
- ✅ Learn channel with Professor Primate mode
- ✅ Startup greeting messages
- ✅ Daily MOTD with weather reports
- ✅ Full chat functionality when mentioned

**Guest Servers** (any other server):
- ✅ Chat responses when mentioned
- ✅ Web search capabilities
- ✅ Image generation (ask via mention)
- ✅ Banana emoji (🍌) reactions
- ❌ No slash commands
- ❌ No scheduled messages

## Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) (v22 or newer) - Check with `node --version`
- [Yarn](https://yarnpkg.com/) (v1.x) - Check with `yarn --version`
- A Discord bot token - [Create one here](https://discord.com/developers/applications)
- An OpenAI API key - [Get one here](https://platform.openai.com/api-keys)
- A Discord server where you have admin permissions

## Step-by-Step Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/primate-prime.git
cd primate-prime
```

### 2. Install Dependencies

```bash
yarn install
```

This will install all required packages including Discord.js and OpenAI libraries.

### 3. Configure Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Discord Configuration
DISCORD_STARTUP_CHANNEL_ID=123456789012345678  # Channel for bot startup messages
DISCORD_LEARN_CHANNEL_ID=123456789012345679    # Channel for learn mode (optional)
DISCORD_TOKEN=your-bot-token-here               # From Discord Developer Portal
DISCORD_GUILD_ID=123456789012345680            # Your server ID (optional - see note below)
DISCORD_APP_ID=123456789012345681              # Your application ID

# OpenAI Configuration  
OPENAI_API_KEY=sk-your-openai-api-key-here     # From OpenAI dashboard
OPENAI_MODEL=gpt-4o-mini                       # Or gpt-3.5-turbo for cheaper
OPENAI_IMAGE_MODEL=dall-e-3                    # For image generation

# Bot Configuration
PRIMATE_PRIME_MOTD_CRON="0 8 * * *"           # Daily message at 8 AM
```

**Multi-Server Architecture**: 
- `DISCORD_GUILD_ID` defines your "main server" with full features
- Main server features: Slash commands, learn channel, startup messages, daily MOTD
- Other servers: Basic chat responses, web search, and image generation via mentions
- The bot can be invited to unlimited servers while maintaining a "home base"

### 4. Getting Discord IDs

To get the required Discord IDs:

1. **Enable Developer Mode**: 
   - Open Discord Settings → Advanced → Enable Developer Mode

2. **Get Server/Guild ID**:
   - Right-click your server name → Copy Server ID

3. **Get Channel IDs**:
   - Right-click any channel → Copy Channel ID

4. **Get Application & Bot Token**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create New Application (or select existing)
   - Copy Application ID from General Information
   - Go to Bot section → Reset Token → Copy the token

### 5. Set Up Discord Bot Permissions

In the Discord Developer Portal:

1. Go to your application → Bot section
2. Under "Privileged Gateway Intents", enable:
   - MESSAGE CONTENT INTENT (required for reading messages)
3. Go to OAuth2 → URL Generator
4. Select scopes: `bot` and `applications.commands`
5. Select bot permissions:
   - Send Messages
   - Read Message History
   - Add Reactions
   - Attach Files
   - Embed Links
   - Use Slash Commands
   - Mention Everyone (for user mentions)
   - Or use permissions integer: `274878072832`
6. Copy the generated URL and open it to invite the bot to your server
   
   Example invite URL:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=274878072832&scope=bot%20applications.commands
   ```

### 6. Build and Start the Bot

Build the TypeScript code:

```bash
yarn build
```

Start the bot:

```bash
yarn start
```

You should see:
```
🍌 APE ONLINE! Logged in as PrimatePrime#1234
Successfully registered slash commands.
```

And in your startup channel:
```
OOH OOH AH AH! PRIMATE PRIME ONLINE. APE READY FOR CHAOS.
```

## Usage

### Mentioning the Bot

Simply @mention the bot in any message:
```
@PrimatePrime explain quantum physics
```

Response:
```
APE BRAIN UNDERSTAND QUANTUM! TINY PARTICLES LIKE TINY BANANAS - 
SOMETIMES HERE, SOMETIMES THERE, SOMETIMES BOTH! SMOOTH-BRAIN 
SCIENTISTS VERY CONFUSED. APE SUGGESTS: DON'T THINK TOO HARD. 
EAT BANANA INSTEAD. OOH AH! 🍌
```

### Slash Commands

**Learn Mode** - For serious educational content:
```
/learn prompt: How do neural networks work?
```

**Image Generation** - Create ape-themed art:
```
/image prompt: cyberpunk gorilla hacker
```

### Conversation Threads

Reply to any bot message to continue the conversation with context.

### Reaction Controls

React with 🍌 to any bot message to regenerate the response.

## File Structure

```
primate-prime/
├── config/               # Hot-reloadable personality files
│   ├── errors.md        # Error messages
│   ├── greetings.md     # Startup greetings
│   ├── instructions_primate.md  # Main APE personality
│   ├── instructions_learn.md    # Professor Primate mode
│   └── motd.md          # Daily message template
├── src/                 # TypeScript source code
│   ├── index.ts         # Entry point
│   ├── constants.ts     # Configuration constants
│   ├── types.ts         # TypeScript type definitions
│   └── services/        # Core services
│       ├── discord/     # Discord client wrapper
│       ├── openai/      # OpenAI integration
│       └── primate-prime/  # Main bot logic
└── dist/               # Compiled JavaScript (after build)
```

## Customizing the Bot

### Changing Personality

Edit the markdown files in `config/` directory:
- `instructions_primate.md` - Main personality
- `greetings.md` - Startup messages  
- `errors.md` - Error responses

Changes are hot-reloaded without restarting!

### Adding New Commands

1. Add to `DISCORD_COMMANDS` in `src/constants.ts`
2. Add handler in `src/services/primate-prime/index.ts`
3. Rebuild and restart

## Troubleshooting

### Bot Not Responding

1. Check bot has MESSAGE CONTENT INTENT enabled
2. Verify bot has permissions in the channel
3. Ensure you're @mentioning correctly
4. Check logs for errors

### "Missing Access" Errors

The bot lacks permissions. Reinvite with correct permissions.

### OpenAI Errors

- Check API key is valid
- Verify you have API credits
- Try a different model (gpt-3.5-turbo is cheaper)

### Build Errors

```bash
# Clean install
rm -rf node_modules dist
yarn install
yarn build
```

## Development

### Running in Development

For development with auto-restart:
```bash
# Install nodemon globally
npm install -g nodemon

# Run with nodemon
nodemon --exec "yarn build && yarn start" --ext ts --watch src
```

### Testing

```bash
yarn test
```

### Code Formatting

```bash
yarn format
```

## Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start dist/index.js --name primate-prime --interpreter="node" --node-args="--loader ./dist/resolve-ts-paths-loader.mjs"

# Save PM2 config
pm2 save
pm2 startup
```

### Using Docker

Create a `Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
CMD ["yarn", "start"]
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Bot authentication token | `MTIzNDU2Nzg5MDEy...` |
| `DISCORD_APP_ID` | Application ID | `1234567890123456` |
| `DISCORD_GUILD_ID` | Main server ID (required) - full features only here | `1234567890123456` |
| `DISCORD_STARTUP_CHANNEL_ID` | Channel for startup messages | `1234567890123456` |
| `DISCORD_LEARN_CHANNEL_ID` | Channel where learn mode is default | `1234567890123456` |
| `OPENAI_API_KEY` | OpenAI API authentication | `sk-...` |
| `OPENAI_MODEL` | Chat model to use | `gpt-4o-mini` |
| `OPENAI_IMAGE_MODEL` | Image generation model | `dall-e-3` |
| `PRIMATE_PRIME_MOTD_CRON` | Schedule for daily messages | `0 8 * * *` |

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/BananaMode`)
3. Commit changes (`git commit -m 'Add banana mode'`)
4. Push to branch (`git push origin feature/BananaMode`)
5. Open a Pull Request

## License

MIT - APE SHARE KNOWLEDGE FREELY 🍌

## Credits

Based on the [Rooivalk](https://github.com/fjlaubscher/rooivalk) bot architecture by Francois Laubscher.

---

**Remember**: APE TOGETHER STRONG! If you need help, open an issue. The ape community is here to help smooth-brains evolve! 🦍💪