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

| Feature | Current | Phase 1 (PWA) | Phase 2 (+ Sync) |
|---------|---------|---------------|------------------|
| View recipes | ✓ Local only | ✓ From IndexedDB | ✓ + Cloud backup |
| Edit recipes | ✗ | ✓ In-app editor | ✓ + Sync changes |
| Add recipes | ✗ | ✓ Create new | ✓ + Cloud save |
| Delete recipes | ✗ | ✓ With confirm | ✓ + Sync delete |
| Search/filter | ✗ | ✓ Client-side | ✓ Same |
| Share recipes | ✗ | ✓ Share URL | ✓ + Share link |
| Import recipes | ✗ | ✓ From file/URL | ✓ + From Drive |
| Works offline | ✓ | ✓ | ✓ With sync queue |
| Android support | ✗ | ✓ | ✓ |
| Multi-device | ✗ | ✗ | ✓ Via Google |

## Phase 1: PWA with IndexedDB (2-3 weeks)

### External Setup Required
1. **HTTPS Hosting** (required for PWA)
   - Option A: GitHub Pages (free, easy)
   - Option B: Netlify/Vercel (free tier, better features)
   - Option C: Self-hosted with Let's Encrypt

2. **Domain (Optional but Recommended)**
   - For better PWA experience and sharing
   - Can use subdomain of existing domain

### Implementation Steps

#### 1.1 PWA Foundation (Days 1-2)
- [ ] Create `manifest.json` with app metadata
- [ ] Create app icons (192x192, 512x512)
- [ ] Implement service worker for offline caching
- [ ] Add install prompt UI
- [ ] Update meta tags in index.html

#### 1.2 Storage Layer Abstraction (Days 3-4)
- [ ] Create `RecipeStore` class with abstract interface
- [ ] Implement `IndexedDBStore` with Dexie.js
- [ ] Migrate existing file-reading logic
- [ ] Add recipe CRUD operations
- [ ] Handle storage quota (request persistent storage)

#### 1.3 Recipe Management Features (Days 5-7)
- [ ] Build recipe editor component
  - [ ] Markdown editor with preview
  - [ ] Frontmatter form (title, ingredients, image)
  - [ ] Image handling (data URLs for offline)
- [ ] Add recipe creation flow
- [ ] Implement delete with confirmation
- [ ] Add basic search/filter functionality

#### 1.4 Import/Export Features (Days 8-9)
- [ ] Import from file (maintain compatibility)
- [ ] Import from URL (fetch recipe)
- [ ] Export single recipe as .md
- [ ] Export all recipes as .zip
- [ ] Bulk import from folder

#### 1.5 UI/UX Improvements (Days 10-11)
- [ ] Add loading states
- [ ] Implement error handling
- [ ] Create settings page
- [ ] Add recipe categories/tags
- [ ] Improve mobile navigation

#### 1.6 Testing & Polish (Days 12-14)
- [ ] Test on multiple devices
- [ ] Verify offline functionality
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Deploy to hosting

## Phase 2: Google Drive Sync (1-2 weeks)

### External Setup Required

1. **Google Cloud Console**
   - Create new project
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Configure authorized domains
   - Set up consent screen

2. **OAuth Configuration**
   - Client ID for web application
   - Authorized JavaScript origins
   - Authorized redirect URIs
   - Publish app (or keep in testing)

### Implementation Steps

#### 2.1 Google Auth Integration (Days 1-2)
- [ ] Integrate Google Identity Services
- [ ] Implement OAuth flow
- [ ] Store refresh tokens securely
- [ ] Add login/logout UI
- [ ] Handle auth errors

#### 2.2 Drive API Integration (Days 3-4)
- [ ] Create `GoogleDriveStore` implementation
- [ ] Set up app folder in Drive
- [ ] Implement file operations (CRUD)
- [ ] Handle API quotas and errors
- [ ] Add progress indicators

#### 2.3 Sync Engine (Days 5-6)
- [ ] Design conflict resolution strategy
- [ ] Implement two-way sync algorithm
- [ ] Create sync queue for offline changes
- [ ] Add sync status UI
- [ ] Handle sync errors gracefully

#### 2.4 User Settings (Day 7)
- [ ] Sync preferences (auto/manual)
- [ ] Conflict resolution preferences
- [ ] Storage location choice
- [ ] Sync frequency settings
- [ ] Data usage warnings

#### 2.5 Testing & Deployment (Days 8-10)
- [ ] Test sync scenarios
- [ ] Verify conflict resolution
- [ ] Test offline-to-online transitions
- [ ] Performance testing
- [ ] Update documentation

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