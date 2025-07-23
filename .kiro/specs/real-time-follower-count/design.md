# Design Document

## Overview

This design outlines the approach to fix the inconsistent real-time follower count updates in the application. Currently, when a user unfollows another user, the follower count decreases immediately on the target user's profile, but when a user follows another user, the follower count doesn't update in real-time on the target user's profile. This design will ensure consistent real-time updates for both follow and unfollow actions.

## Architecture

The application uses Supabase for both database operations and real-time subscriptions. The current architecture includes:

1. A `follows` table in the database that tracks follower/following relationships
2. Real-time subscriptions using Supabase channels to listen for changes
3. Frontend components that display follower counts and follow status

The issue appears to be in how the real-time subscription is handling follow events versus unfollow events, or how the UI is updating in response to these events.

## Components and Interfaces

### Profile.tsx Component

This is the main component that needs to be modified. It currently:

1. Sets up real-time subscriptions for follows
2. Handles follow/unfollow actions
3. Displays follower/following counts
4. Updates UI based on follow status changes

The key functions that need to be examined and potentially modified are:

- `fetchFollowCounts()`: Retrieves the current follower and following counts
- `handleFollow()`: Handles the follow/unfollow action
- `checkFollowStatus()`: Checks if the current user is following a profile
- Real-time subscription setup for follows

### Real-time Subscription Implementation

The current real-time subscription is set up in the Profile component:

```typescript
// Real-time subscription for follows updates
useEffect(() => {
  if (!profile?.user_id) return;

  const followsChannel = supabase
    .channel(`follows-${profile.user_id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'follows'
      },
      async (payload) => {
        // Check if this follow relationship affects the current profile
        const affectsThisProfile = 
          payload.new?.follower_id === profile.user_id || 
          payload.new?.following_id === profile.user_id ||
          payload.old?.follower_id === profile.user_id || 
          payload.old?.following_id === profile.user_id;

        if (affectsThisProfile) {
          // Refresh follow counts for any profile view
          fetchFollowCounts();
        }

        // If viewing another user's profile and they follow/unfollow the current user
        if (!isOwnProfile && user) {
          const affectsCurrentUser = 
            (payload.new?.follower_id === profile.user_id && payload.new?.following_id === user.id) ||
            (payload.old?.follower_id === profile.user_id && payload.old?.following_id === user.id);
          
          if (affectsCurrentUser) {
            // Update follow status
            checkFollowStatus();
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(followsChannel);
  };
}, [profile?.user_id, isOwnProfile, user]);
```

## Data Models

### Follows Table

```sql
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);
```

## Error Handling

The current implementation includes some error handling, but it may need to be enhanced:

1. Optimistic updates with rollback on error
2. Error toasts for failed follow/unfollow actions
3. Loading states to prevent duplicate actions

## Testing Strategy

### Unit Testing

1. Test the `handleFollow` function for both follow and unfollow scenarios
2. Test the real-time subscription handler with various payload types
3. Test the UI updates in response to follow/unfollow actions

### Integration Testing

1. Test follow/unfollow actions between two users
2. Verify real-time updates on both users' profiles
3. Test edge cases like rapid follow/unfollow actions

### End-to-End Testing

1. Test the complete follow/unfollow flow in a real environment
2. Verify counts update correctly across multiple browser sessions
3. Test performance with many simultaneous users

## Implementation Approach

After analyzing the code, the issue appears to be in how the real-time subscription is handling follow events or how the UI is updating in response to these events. The fix will involve:

1. Debugging the real-time subscription to ensure it correctly processes both follow and unfollow events
2. Ensuring the UI updates consistently for both actions
3. Adding proper error handling and loading states

The most likely issues are:

1. The real-time subscription might not be correctly identifying follow events vs. unfollow events
2. The payload structure might be different between the two types of events
3. The UI update logic might be inconsistent between the two actions

## Security Considerations

1. Ensure Row Level Security (RLS) policies are properly configured for the follows table
2. Validate user permissions before allowing follow/unfollow actions
3. Prevent unauthorized access to follower/following data

## Performance Considerations

1. Optimize real-time subscriptions to minimize unnecessary updates
2. Use efficient queries for follower count retrieval
3. Implement proper cleanup for subscriptions to prevent memory leaks