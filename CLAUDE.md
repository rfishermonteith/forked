# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a local-first recipe management web application built with vanilla HTML/CSS/JavaScript. It reads Markdown recipe files from the user's local filesystem and displays them in a clean, minimal interface.

## Development Setup

No build process required. Simply open `index.html` in a modern browser (Chrome/Edge recommended for full File System Access API support).

## Architecture

### Technology Stack
- **Frontend**: Pure HTML/CSS/JavaScript with ES Modules
- **Dependencies**: Loaded via CDN (no npm/build required)
  - `gray-matter` - Parses YAML frontmatter
  - `markdown-it` - Renders Markdown to HTML  
  - `DOMPurify` - Sanitizes HTML output
  - `idb-keyval` - Persists directory handles

### Key Components

1. **index.html**: Single-page application containing all logic
   - Recipe loading and parsing logic (lines ~50-150)
   - File system access handling (lines ~150-250)
   - UI rendering and navigation (lines ~250-350)

2. **Recipe Format**: Markdown files with YAML frontmatter
   ```markdown
   ---
   title: Recipe Name
   ingredients:
     - ingredient 1
     - ingredient 2
   image: optional-image-url.jpg
   ---
   
   Recipe instructions in Markdown...
   ```

### Navigation System
- Hash-based routing: `#recipe=recipe-filename`
- Automatic file listing from selected directory
- Persists directory selection across sessions

## Common Tasks

### Testing Recipe Display
1. Add new `.md` files to `sample_data/` directory
2. Open `index.html` in browser
3. Select the `sample_data/` folder when prompted
4. Click on recipes to view them

### Adding New Features
- All code is in `index.html` - no build step needed
- Use ES modules from CDNs for new dependencies
- Maintain compatibility with File System Access API and webkit fallback

## Current Limitations
- View-only (no editing functionality)
- No recipe sharing/export features
- No search or filtering capabilities
- Requires manual folder selection on first use

## Planned Architecture
The project is transitioning to a PWA + Cloud Sync architecture:
- **Phase 1**: PWA with IndexedDB for local storage (COMPLETED)
- **Phase 2**: Optional cloud sync for multi-device access
- Maintains Markdown + YAML frontmatter format for data portability

### Cloud Storage Abstraction
The app uses an abstract `CloudStorageProvider` interface that allows swapping between different cloud providers:
- **Interface**: `cloud-storage-interface.js` - Defines the contract all providers must implement
- **Providers**: `google-drive-provider.js` (first implementation)
- **Sync Manager**: `sync-manager.js` - Provider-agnostic sync logic

This design allows easy addition of Dropbox, OneDrive, S3, or any other storage backend without changing the core application logic.