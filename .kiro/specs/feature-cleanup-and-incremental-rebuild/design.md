# Design Document

## Overview

This design outlines a systematic approach to remove all social features (likes, views, comments, and follows) from the application and then incrementally add them back one by one. This approach will help isolate issues, ensure proper functionality, and create a more stable codebase.

The application is a React-based video sharing platform using Supabase as the backend. The current implementation has complex interdependencies between social features that are causing stability issues.

## Architecture

### Current State Analysis

The application currently has the following social features integrated:

1. **Likes System**: `video_likes` table with real-time subscriptions
2. **Views Tracking**: `video_views` table with automatic view counting
3. **Comments System**: `comments` table with CRUD operations
4. **Follow System**: `follows` table with follower/following relationships

### Target Architecture

The cleanup and rebuild process will follow this architecture:

```
Phase 1: Complete Removal
├── Remove Frontend Components
├── Remove Database Tables/Functions
├── Remove Real-time Subscriptions
└── Verify Clean State

Phase 2-5: Incremental Addition
├── Phase 2: Add Likes Only
├── Phase 3: Add Views Only  
├── Phase 4: Add Comments Only
└── Phase 5: Add Follows Only
```

## Components and Interfaces

### Frontend Components to Modify

1. **Feed.tsx**
   - Remove like button functionality and state
   - Remove view recording and display
   - Remove comment count display
   - Remove follow status checking

2. **VideoPlayer.tsx**
   - Remove comments section entirely
   - Remove like functionality
   - Remove view recording

3. **Profile.tsx**
   - Remove follow/unfollow buttons
   - Remove follower/following counts
   - Remove follower/following lists

4. **Friends.tsx**
   - Remove like functionality
   - Remove follow-related features

5. **Settings.tsx**
   - Remove notification settings for social features

### Backend Components to Remove

1. **Database Tables**
   - `video_likes` table
   - `video_views` table  
   - `comments` table
   - `follows` table

2. **Database Functions**
   - `record_video_view()`
   - `get_genuine_view_count()`
   - `update_video_view_count()`
   - All related triggers

3. **Database Columns**
   - `videos.view_count`
   - `videos.like_count`
   - `videos.comment_count`
   - `profiles.follower_count`

## Data Models

### Simplified Video Model (After Cleanup)

```typescript
interface Video {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  category?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}
```

### Simplified Profile Model (After Cleanup)

```typescript
interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}
```

### Incremental Model Additions

Each phase will add back specific fields and tables:

- **Phase 2 (Likes)**: Add `video_likes` table and `like_count` column
- **Phase 3 (Views)**: Add `video_views` table and `view_count` column  
- **Phase 4 (Comments)**: Add `comments` table and `comment_count` column
- **Phase 5 (Follows)**: Add `follows` table and `follower_count` column

## Error Handling

### Removal Phase Error Handling

1. **Database Dependency Errors**
   - Drop dependent triggers before dropping functions
   - Drop dependent views before dropping tables
   - Handle foreign key constraints properly

2. **Frontend Compilation Errors**
   - Remove all references to removed features
   - Replace with placeholder UI or remove entirely
   - Handle TypeScript type errors

3. **Runtime Errors**
   - Remove real-time subscriptions to non-existent tables
   - Handle missing data gracefully
   - Provide fallback values for removed counts

### Incremental Addition Error Handling

1. **Database Migration Errors**
   - Test each migration in isolation
   - Provide rollback scripts for each phase
   - Validate data integrity after each addition

2. **Frontend Integration Errors**
   - Add features incrementally with proper error boundaries
   - Test each feature in isolation before proceeding
   - Maintain backward compatibility during transitions

## Testing Strategy

### Removal Phase Testing

1. **Database Testing**
   - Verify all social feature tables are removed
   - Confirm all related functions and triggers are dropped
   - Test that core video functionality still works

2. **Frontend Testing**
   - Verify application compiles without errors
   - Test video upload and playback functionality
   - Confirm no broken UI elements or missing components

3. **Integration Testing**
   - Test user authentication and profile management
   - Verify video CRUD operations work correctly
   - Test chat functionality remains intact

### Incremental Addition Testing

1. **Feature Isolation Testing**
   - Test each feature independently before adding the next
   - Verify database operations work correctly
   - Test real-time functionality where applicable

2. **Integration Testing**
   - Test interactions between newly added features
   - Verify no conflicts with existing functionality
   - Test performance impact of each addition

3. **End-to-End Testing**
   - Test complete user workflows after each phase
   - Verify UI/UX remains consistent
   - Test error scenarios and edge cases

## Implementation Phases

### Phase 1: Complete Removal
- Remove all frontend social feature code
- Drop all social feature database tables and functions
- Clean up database schema
- Verify application stability

### Phase 2: Add Likes System
- Create `video_likes` table with proper RLS policies
- Add like functionality to frontend components
- Implement real-time like updates
- Add `like_count` column to videos table

### Phase 3: Add Views System  
- Create `video_views` table with tracking logic
- Implement view recording functionality
- Add view count display to frontend
- Add `view_count` column to videos table

### Phase 4: Add Comments System
- Create `comments` table with proper relationships
- Implement comment CRUD operations
- Add comments UI to video player
- Add `comment_count` column to videos table

### Phase 5: Add Follow System
- Create `follows` table with user relationships
- Implement follow/unfollow functionality
- Add follower counts and lists to profiles
- Add `follower_count` column to profiles table

## Security Considerations

1. **Row Level Security (RLS)**
   - Ensure proper RLS policies for each new table
   - Test access controls thoroughly
   - Prevent unauthorized data access

2. **Function Security**
   - Use `SECURITY DEFINER` appropriately
   - Set proper search paths in functions
   - Validate input parameters

3. **Frontend Security**
   - Validate user permissions before UI actions
   - Handle authentication states properly
   - Prevent client-side manipulation of counts

## Performance Considerations

1. **Database Optimization**
   - Add proper indexes for each new table
   - Optimize queries for real-time features
   - Monitor query performance after each addition

2. **Real-time Subscriptions**
   - Limit subscription scope to necessary data
   - Implement proper cleanup for subscriptions
   - Monitor connection limits and performance

3. **Frontend Performance**
   - Implement proper state management
   - Use React optimization techniques (useMemo, useCallback)
   - Minimize re-renders during real-time updates