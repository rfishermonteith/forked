# Recipe App Implementation Plan: PWA + Google Drive

## Executive Summary

Transform the current local-file-based recipe viewer into a Progressive Web App (PWA) with optional Google Drive synchronization. This approach solves Android filesystem access issues while maintaining the local-first philosophy.

## Architecture Overview

```
┌─────────────────────┐
│   User Interface    │
│  (HTML/CSS/JS PWA)  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Storage Layer     │
│  (Abstract API)     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐    ┌───▼───┐
│IndexedDB│   │Drive  │
│(Local) │    │ API   │
└────────┘    └───────┘
```

## Feature Enablement Matrix

| Feature | Original | Phase 1 (PWA) | Phase 2 (+ Sync) | Current Status |
|---------|----------|---------------|------------------|----------------|
| View recipes | ✓ Local only | ✓ From IndexedDB | ✓ + Cloud backup | ✅ **Done** |
| Beautiful design | ✗ | ✓ Modern UI/UX | ✓ Same | ❌ **Top Priority** |
| Edit recipes | ✗ | ✓ In-app editor | ✓ + Sync changes | ❌ High Priority |
| Add recipes | ✗ | ✓ Create new | ✓ + Cloud save | ❌ High Priority |
| Delete recipes | ✗ | ✓ With confirm | ✓ + Sync delete | ❌ Future |
| Search/filter | ✗ | ✓ Client-side | ✓ Same | ❌ Future |
| Share recipes | ✗ | ✓ Share URL | ✓ + Share link | ❌ Future |
| Import recipes | ✗ | ✓ From file/URL | ✓ + From Drive | ❌ Future |
| Works offline | ✓ | ✓ | ✓ With sync queue | ✅ **Done** |
| Android support | ✗ | ✓ | ✓ | ✅ **Done** |
| Multi-device | ✗ | ✗ | ✓ Via Google | ✅ **Done** (read-only) |

## Current Implementation Status

### ✅ Completed Features
- **PWA Foundation**: Service worker, manifest, offline support, installable
- **Google Drive Sync**: OAuth authentication, persistent tokens, smart folder discovery
- **Cross-Platform**: Works on desktop and mobile (Android)
- **Recipe Viewing**: Clean display with markdown rendering and YAML frontmatter

### 🚧 In Progress  
- **GitHub Pages Deployment**: Working with automatic config deployment

### ❌ Next Priorities
1. **Beautiful Design** - Modern, kitchen-friendly UI
2. **Recipe Editing** - In-app editor with live preview
3. **Recipe Creation** - Add new recipes directly in the app

## Phase 1: PWA Foundation ✅ COMPLETED

#### 1.1 PWA Foundation
- ✅ Create `manifest.json` with app metadata
- ✅ Create app icons (192x192, 512x512)
- ✅ Implement service worker for offline caching
- ✅ Add install prompt UI
- ✅ Update meta tags in index.html

#### 1.2 Storage Layer
- ✅ Implement IndexedDB storage with idb-keyval
- ✅ Migrate file-reading logic to work with synced data
- ❌ Recipe CRUD operations (view-only currently)

## Phase 2: Google Drive Sync ✅ COMPLETED

#### 2.1 Google Auth Integration
- ✅ Integrate Google Identity Services
- ✅ Implement OAuth flow with persistent tokens
- ✅ Add login/logout UI
- ✅ Handle auth errors

#### 2.2 Drive API Integration
- ✅ Create GoogleDriveProvider implementation
- ✅ Smart folder discovery (works with 100+ folders)
- ✅ Read operations from Drive to IndexedDB
- ❌ Write operations (local → Drive sync)

#### 2.3 Basic Sync Engine
- ✅ One-way sync (Drive → IndexedDB)
- ✅ Auto-reconnection and folder restoration
- ✅ Sync status UI
- ❌ Two-way sync and conflict resolution

## Phase 3: Beautiful Design & Recipe Management (NEXT)

### Implementation Priority

#### 3.1 Beautiful Design (Top Priority - 1 week)
- [ ] Modern, clean recipe display layout
- [ ] Kitchen-friendly typography and spacing  
- [ ] Improved mobile navigation and touch targets
- [ ] Better color scheme and visual hierarchy
- [ ] Loading states and smooth transitions
- [ ] Recipe card design for index view

#### 3.2 Recipe Editing (High Priority - 1 week)
- [ ] In-app markdown editor with live preview
- [ ] Frontmatter form editor (title, ingredients, image)
- [ ] Save changes to IndexedDB
- [ ] Basic validation and error handling

#### 3.3 Recipe Creation (High Priority - 3 days)
- [ ] "Add New Recipe" button and flow
- [ ] Recipe template with common fields
- [ ] Image upload and handling
- [ ] Save new recipes to IndexedDB

## Phase 4: Advanced Features (FUTURE)

#### 4.1 Two-Way Sync
- [ ] Push local changes back to Google Drive
- [ ] Conflict resolution UI
- [ ] Sync queue for offline changes

#### 4.2 Recipe Management
- [ ] Delete recipes with confirmation
- [ ] Search and filter functionality
- [ ] Recipe categories and tags
- [ ] Bulk import/export

#### 4.3 Sharing & Export
- [ ] Share recipe as link/image/PDF
- [ ] Export ingredients to shopping list
- [ ] Print-friendly layouts

## Technical Decisions

### Storage Format
- Keep Markdown + YAML frontmatter format
- Store as text in IndexedDB
- Sync as .md files to Google Drive
- This maintains data portability

### Libraries to Add
```javascript
// Phase 1
"dexie": "^3.x",           // IndexedDB wrapper
"markdown-editor": "^x.x",  // For editing
"jszip": "^3.x",           // For bulk export

// Phase 2
"google-auth-library": "^8.x", // Google OAuth
"googleapis": "^120.x",        // Drive API
```

### Data Schema
```javascript
// IndexedDB Schema
recipes: {
  id: string,          // UUID
  filename: string,    // original-name.md
  content: string,     // Full markdown content
  lastModified: Date,
  syncStatus: 'local' | 'synced' | 'pending',
  driveFileId?: string // For sync tracking
}
```

### Sync Strategy
1. Use last-modified timestamps
2. Local changes win by default
3. Option to view/resolve conflicts
4. Queue offline changes
5. Sync on app launch + manual trigger

## Migration Path

1. Existing users can import their recipe folders
2. Progressive enhancement - sync is optional
3. Maintain backward compatibility with .md format
4. Export functionality preserves original format

## Success Metrics

- PWA installable on Android
- No folder selection on each visit
- Sub-second recipe loading
- Successful offline usage
- Optional multi-device sync
- Zero data loss during sync

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google API changes | Abstract storage layer, easy to swap |
| Sync conflicts | Clear UI for resolution, local-first |
| Storage quotas | Request persistent storage, warn users |
| OAuth complexity | Clear setup documentation, test mode |
| Data loss | Multiple backups, export functionality |

## Next Steps

1. Set up GitHub Pages or chosen hosting
2. Create Google Cloud project (for Phase 2)
3. Start Phase 1 implementation
4. User testing after Phase 1
5. Iterate based on feedback
6. Implement Phase 2 if Phase 1 successful