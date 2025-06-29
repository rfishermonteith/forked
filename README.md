# forked

A local-first Progressive Web App for sharing recipes between partners/family, with optional Google Drive sync for multi-device access.

## Current Features ✅

1. **Beautiful Recipe Display** - Clean, minimal interface with pictures
2. **Multi-Device Access** - Works on desktop (Windows, Mac, Linux) and mobile (Android)
3. **Google Drive Sync** - Automatic sync from your Google Drive folder
4. **Offline Support** - PWA works without internet after first load
5. **Persistent Authentication** - Stay logged in across sessions
6. **Smart Folder Discovery** - Finds your RecipeBox folder even with 100+ folders
7. **Markdown + YAML Format** - Future-proof, interoperable recipe storage

## Planned Features 🚧

1. **Beautiful Design** - Modern, kitchen-friendly UI with better typography and layout
2. **Recipe Editing** - Edit recipes directly in the app
3. **Recipe Creation** - Add new recipes with built-in editor
4. **Two-Way Sync** - Push local changes back to Google Drive
5. **Recipe Management** - Delete, organize, and tag recipes
6. **Search & Filter** - Find recipes by ingredients, tags, or content
7. **Recipe Sharing** - Share as image, PDF, or webpage
8. **Shopping List Export** - Extract ingredients to shopping list
9. **OCR Import** - Add recipes by photo or copy-paste (via LLM)

## Project Vision

This repo is a way for my partner and I to share our collection of recipes between us, which will allow us to:
1. Access them from anywhere (e.g. in the kitchen, at the shops)
2. Edit them easily (e.g. in a text editor or browser)
3. Display them minimalistically and beautifully (e.g. with a picture)
4. Have access to them forever, in a useful way (so keep them in a maximally interoperable format, with limited need for maintenance)
5. Share them easily with friends (e.g. as a image, pdf or webpage - we'd also like to be able to print them out)
6. Add comments to the recipes, to track when we used them, and what we thought at the time
7. It should work on desktop (Windows, Mac & Linux) and mobile (Android)

Some nice-to-haves:
1. This should be local-first (this will make it easier to maintain)
2. We should be able to add recipes by taking a photo or copy pasting from elsewhere
3. This should leave the syncing to another service
4. We should be able to export the ingredients for a recipe to a shopping list

## Implementation Status

- ✅ **Phase 1**: PWA Foundation (service worker, offline, installable)
- ✅ **Phase 2**: Google Drive Integration (authentication, sync, folder discovery) 
- 🚧 **Phase 3**: Beautiful Design & Recipe Management (UI improvements, editing, creation)
- 🔄 **Phase 4**: Advanced Features (two-way sync, search, sharing)

### Current Priorities
1. **Beautiful Design** (Top Priority) - Modern, kitchen-friendly UI
2. **Recipe Editing** - Edit existing recipes in-app
3. **Recipe Creation** - Add new recipes with built-in editor

## Testing on Mobile (Termux/Android)

### Quick Start

1. **Install Termux** from F-Droid (not Play Store)
   
2. **Clone and test**:
   ```bash
   # Install git if needed
   pkg install git
   
   # Clone your branch
   git clone -b pwa-implementation https://github.com/yourusername/forked.git
   cd forked
   
   # Run test server
   bash test-mobile.sh
   ```

3. **Open in Chrome/Firefox**:
   - Visit `http://localhost:8080/forked/` (root redirects here automatically)
   - Look for install prompt or use browser menu → "Install app"

### Testing Checklist

#### PWA Installation
- [ ] Install banner appears (if not already installed)
- [ ] App installs successfully
- [ ] App icon appears on home screen
- [ ] App opens in standalone mode (no browser UI)

#### Offline Functionality
- [ ] Load the app online first
- [ ] Enable airplane mode
- [ ] App still loads and shows cached content
- [ ] Navigation between recipes works offline

#### Mobile-Specific
- [ ] Touch targets are large enough
- [ ] No horizontal scrolling
- [ ] Keyboard doesn't cover input fields
- [ ] Back button works as expected

### Debugging Tips

**View Service Worker status:**
- In Chrome: `chrome://inspect/#service-workers`
- Connect via USB debugging to see mobile Chrome

**Common Issues:**
- **"Install" not appearing:** Visit site twice, wait 30 seconds between visits
- **Service Worker not registering:** Check console, ensure HTTPS/localhost, clear browser data

## Google Drive Sync Setup ✅

Google Drive sync is now working! The app automatically finds and syncs from a "RecipeBox" folder in your Google Drive.

### Quick Setup

1. **Create a RecipeBox folder** in your Google Drive root
2. **Add your recipe .md files** to this folder
3. **Visit the app** and click "Connect to Google Drive"
4. **Grant permissions** when prompted
5. **Your recipes sync automatically!**

### How It Works

- **Smart Discovery**: Finds your RecipeBox folder even with 100+ folders in Drive
- **Persistent Auth**: Stays logged in across browser sessions
- **Auto-Sync**: Recipes appear immediately after connecting
- **Offline Support**: Recipes cached locally for offline viewing

### Recipe Format

Store recipes as `.md` files with YAML frontmatter:

```markdown
---
title: Delicious Pasta
ingredients:
  - 400g pasta
  - 2 cloves garlic
  - olive oil
image: https://example.com/pasta.jpg
---

# Instructions

1. Boil water and cook pasta
2. Sauté garlic in olive oil
3. Combine and serve!
```

### For Developers

To set up your own instance with a different Google Cloud project:

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Configure authorized domains for your deployment  
3. Update the client ID in `config.js`
4. Deploy to your preferred hosting

### Current Limitations

- **Read-Only**: Can view and sync recipes from Drive, but can't edit yet
- **One-Way Sync**: Drive → App only (no local changes pushed back)
- **Manual Folder**: Must create "RecipeBox" folder manually

These will be addressed in upcoming releases!
