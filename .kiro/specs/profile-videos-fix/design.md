# Design Document

## Overview

This design addresses two related issues:
1. User videos not displaying on the profile page
2. TypeScript error in the Feed component related to accessing the `profiles` property

The solution involves fixing the database query in the Profile component to properly fetch user videos and modifying the Feed component to correctly handle the profiles relationship.

## Architecture

The application uses a React frontend with TypeScript and Supabase as the backend database service. Components communicate with Supabase using the Supabase client to fetch and manipulate data.

Key components involved:
- `Profile.tsx`: Displays user profile information and videos
- `Feed.tsx`: Displays a feed of videos with filtering capabilities
- `ModalVerticalFeed.tsx`: Displays videos in a modal view

## Components and Interfaces

### Profile Component

The Profile component needs to be updated to properly fetch and display user videos. Currently, it has a `fetchUserVideos` function that attempts to fetch videos for a user, but it may not be working correctly.

```typescript
// Current implementation
const fetchUserVideos = async (targetUserId: string) => {
  try {
    const { data: dbVideos, error: dbError } = await supabase
      .from('videos')
      .select('*, profiles!inner(username, avatar_url)')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    setUserVideos(dbVideos || []);
  } catch (err) {
    console.error('Error fetching user videos:', err);
    setUserVideos([]);
  }
};
```

### Feed Component

The Feed component has a TypeScript error when trying to access `profiles.deactivated` on video objects. The issue is that the query doesn't include the profiles data with the deactivated field.

```typescript
// Current implementation with error
const fetchVideos = async () => {
  // ...
  let query = supabase
    .from('videos')
    .select(`*, like_count, view_count`)
    .order('created_at', { ascending: false })
    .limit(100);
  // ...
  // This line causes the TypeScript error
  const filtered = (data || []).filter(v => !v.profiles?.deactivated);
  // ...
};
```

## Data Models

### Video Object

The video object returned from Supabase should include:
- Basic video properties (id, title, description, etc.)
- A profiles property when joined with the profiles table

```typescript
interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  user_id: string;
  created_at: string;
  duration: number;
  category: string;
  like_count: number;
  view_count: number;
  // Other video properties
  
  // When joined with profiles
  profiles?: {
    username: string;
    avatar_url: string;
    deactivated?: boolean;
  };
}
```

## Error Handling

- Add proper error handling for database queries
- Use optional chaining (`?.`) when accessing potentially undefined properties
- Add fallback UI states when videos can't be loaded

## Testing Strategy

1. Manual testing of the Profile page to ensure videos are displayed correctly
2. TypeScript compilation check to ensure no type errors
3. Test with both active and deactivated profiles to ensure filtering works correctly
4. Test with various user scenarios (own profile, other user's profile)