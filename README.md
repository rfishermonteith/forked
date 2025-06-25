# forked

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

## Steps to complete:
- [ ] Decide on a format to store the recipes
- [ ] Decide how to render the recipes
- [ ] Implement recipe rendering
- [ ] Decide how to sync between devices
- [ ] Implement syncing
- [ ] Implement recipe printing and sharing
- [ ] Implement editor for recipes (WYSIWYG if possible)
- [ ] Implement OCR and text import of recipes (likely via LLM)

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
