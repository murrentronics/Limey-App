import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, Send, Smile, Heart, Keyboard, Coffee, Plane, Trophy, Shirt, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  video_id: string;
  parent_id?: string;
  created_at: string;
  like_count: number;
  profiles: {
    username: string;
    avatar_url?: string;
    display_name?: string;
  };
  replies?: Comment[];
  is_liked?: boolean;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle?: string;
  onCommentCountChange?: (videoId: string, newCount: number) => void;
}

const EMOJI_CATEGORIES = {
  smileys: {
    icon: Smile,
    name: 'Smileys & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
      '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
      '😠', '😡', '🤬', '😳', '😱'
    ]
  }, food: {

    icon: Coffee,
    name: 'Food & Drink',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆',
      '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄',
      '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯',
      '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩',
      '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙',
      '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲',
      '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚',
      '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻',
      '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍼', '🥛'
    ]
  },
  travel: {
    icon: Plane,
    name: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚎', '🏎️', '🚓', '🚑',
      '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
      '🚲', '🛴', '🛼', '🚁', '🛸', '✈️', '🛩️',
      '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚢', '⛵',
      '🚤', '🛥️', '🛳️', '⛴️', '🚟', '🚠', '🚡',
      '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉',
      '🚊', '🚝', '🚞', '🚋', '🚍', '🏗️', '🌁', '🗼',
      '🏭', '⛲', '🏰', '🏯', '🗾', '🎌', '🗻', '🌋'
    ]
  },
  sports: {
    icon: Trophy,
    name: 'Sports & Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛷', '⛸️', '🥌', '🎿',
      '⛷️', '🏂', '🏋️‍♀️', '🏋️‍♂️', '🤼‍♀️', '🤼‍♂️', '🤸‍♀️',
      '🤸‍♂️', '⛹️‍♀️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾‍♂️', '🏌️‍♀️', '🏌️‍♂️',
      '🏇', '🧘‍♀️', '🧘‍♂️', '🏄‍♀️', '🏄‍♂️', '🏊‍♀️', '🏊‍♂️', '🤽‍♀️',
      '🤽‍♂️', '🚣‍♀️', '🚣‍♂️', '🧗‍♀️', '🧗‍♂️', '🚵‍♀️', '🚵‍♂️', '🚴‍♀️'
    ]
  },
  objects: {
    icon: Shirt,
    name: 'Objects & Symbols',
    emojis: [
      '👑', '🎩', '🧢', '🪖', '⛑️', '📿', '💄', '💍',
      '💎', '🔇', '🔈', '🔉', '🔊', '📢', '📣', '📯',
      '🔔', '🔕', '🎼', '🎵', '🎶', '🎙️', '🎚️', '🎛️',
      '🎧', '📻', '🎷', '🪗', '🎸', '🎹', '🎺',
      '🎻', '🪕', '🥁', '🪘', '📱', '📲', '☎️', '📞',
      '📟', '📠', '🔋', '🔌', '💻', '🖥️', '🖨️', '⌨️',
      '🖱️', '🖲️', '💽', '💾', '💿', '📀', '🧮', '🎥',
      '🎞️', '📽️', '📺', '📷', '📸', '📹', '📼',
      '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾',
      '⚖️', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩'
    ]
  },
  gifs: {
    icon: Zap,
    name: 'GIFs',
    emojis: []
  }
};

const CommentsModal: React.FC<CommentsModalProps> = ({ isOpen, onClose, videoId, videoTitle, onCommentCountChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState('smileys');
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [showFullscreenComments, setShowFullscreenComments] = useState(false);
  const [commentLikes, setCommentLikes] = useState<{ [key: string]: boolean }>({});
  const [longPressedComment, setLongPressedComment] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<{ [key: string]: boolean }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  // Note: Real-time subscriptions removed to prevent reloads
  // All updates are now handled locally for better UX

  const fetchComments = async () => {
    try {
      setLoading(true);

      const { data: commentsData, error } = await supabase
        .from('comments' as any)
        .select('*')
        .eq('video_id', videoId)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('relation "comments" does not exist')) {
          setComments([]);
          setLoading(false);
          return;
        }
        throw error;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, display_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as { [key: string]: any });

      const commentsWithReplies = await Promise.all(
        commentsData.map(async (comment) => {
          // Get accurate like count from comment_likes table
          const { data: likesData, error: likesError } = await supabase
            .from('comment_likes' as any)
            .select('id')
            .eq('comment_id', comment.id);

          const actualLikeCount = likesError ? 0 : (likesData?.length || 0);

          const { data: replies, error: repliesError } = await supabase
            .from('comments' as any)
            .select('*')
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true });

          if (repliesError) {
            console.error('Error fetching replies:', repliesError);
            return {
              ...comment,
              like_count: actualLikeCount,
              profiles: profilesMap[comment.user_id] || { username: 'Unknown', avatar_url: null, display_name: null },
              replies: []
            };
          }

          const repliesWithProfiles = await Promise.all((replies || []).map(async (reply) => {
            // Get accurate like count for replies too
            const { data: replyLikesData, error: replyLikesError } = await supabase
              .from('comment_likes' as any)
              .select('id')
              .eq('comment_id', reply.id);

            const replyActualLikeCount = replyLikesError ? 0 : (replyLikesData?.length || 0);

            return {
              ...reply,
              like_count: replyActualLikeCount,
              profiles: profilesMap[reply.user_id] || { username: 'Unknown', avatar_url: null, display_name: null }
            };
          }));

          return {
            ...comment,
            like_count: actualLikeCount,
            profiles: profilesMap[comment.user_id] || { username: 'Unknown', avatar_url: null, display_name: null },
            replies: repliesWithProfiles
          };
        })
      );

      setComments(commentsWithReplies);

      if (user && commentsWithReplies.length > 0) {
        const allCommentIds = commentsWithReplies.flatMap(comment =>
          [comment.id, ...(comment.replies?.map(reply => reply.id) || [])]
        );

        const { data: likesData } = await supabase
          .from('comment_likes' as any)
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', allCommentIds);

        const likesMap = (likesData || []).reduce((acc, like) => {
          acc[like.comment_id] = true;
          return acc;
        }, {} as { [key: string]: boolean });

        setCommentLikes(likesMap);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('comments' as any)
        .insert({
          content: newComment.trim(),
          user_id: user.id,
          video_id: videoId
        })
        .select('*')
        .single();

      if (error) {
        if (error.message?.includes('relation "comments" does not exist')) {
          toast({
            title: 'Comments not available',
            description: 'The comments system is being set up. Please try again later.',
            variant: 'destructive'
          });
          return;
        }
        throw error;
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, display_name')
        .eq('user_id', user.id)
        .single();

      const commentWithProfile = {
        ...data,
        profiles: userProfile || { username: user.email?.split('@')[0] || 'Unknown', avatar_url: null, display_name: null },
        replies: []
      };

      setComments(prev => {
        const newComments = [commentWithProfile, ...prev];
        // Update comment count in parent component
        if (onCommentCountChange) {
          onCommentCountChange(videoId, newComments.length);
        }
        return newComments;
      });
      setNewComment('');

      await supabase.rpc('increment_comment_count' as any, { video_uuid: videoId });

      toast({
        title: 'Comment posted!',
        description: 'Your comment has been added.',
        className: 'bg-green-600 text-white border-green-700'
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive'
      });
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('comments' as any)
        .insert({
          content: replyText.trim(),
          user_id: user.id,
          video_id: videoId,
          parent_id: parentId
        })
        .select('*')
        .single();

      if (error) throw error;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, display_name')
        .eq('user_id', user.id)
        .single();

      const replyWithProfile = {
        ...data,
        profiles: userProfile || { username: user.email?.split('@')[0] || 'Unknown', avatar_url: null, display_name: null }
      };

      setComments(prev => prev.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), replyWithProfile]
          };
        }
        return comment;
      }));

      setReplyText('');
      setReplyingTo(null);

      const parentComment = comments.find(c => c.id === parentId);
      if (parentComment && parentComment.user_id !== user.id) {
        await supabase
          .from('system_notifications' as any)
          .insert({
            to_user_id: parentComment.user_id,
            from_user_id: user.id,
            type: 'comment_reply',
            title: 'New comment reply',
            message: `New comment reply from ${user.email?.split('@')[0] || 'Someone'}`,
            video_id: videoId
          });
      }

      toast({
        title: 'Reply posted!',
        description: 'Your reply has been added.',
        className: 'bg-green-600 text-white border-green-700'
      });
    } catch (error) {
      console.error('Error posting reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to post reply',
        variant: 'destructive'
      });
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    const isLiked = commentLikes[commentId];

    // Update UI immediately for better user experience
    setCommentLikes(prev => ({
      ...prev,
      [commentId]: !isLiked
    }));

    // Update like count locally
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          like_count: isLiked ? Math.max(0, comment.like_count - 1) : comment.like_count + 1
        };
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: comment.replies.map(reply => {
            if (reply.id === commentId) {
              return {
                ...reply,
                like_count: isLiked ? Math.max(0, reply.like_count - 1) : reply.like_count + 1
              };
            }
            return reply;
          })
        };
      }
      return comment;
    }));

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('comment_likes' as any)
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        await supabase.rpc('decrement_comment_likes' as any, { comment_uuid: commentId });
      } else {
        // Like
        await supabase
          .from('comment_likes' as any)
          .insert({
            comment_id: commentId,
            user_id: user.id
          });

        await supabase.rpc('increment_comment_likes' as any, { comment_uuid: commentId });
      }
    } catch (error) {
      console.error('Error liking comment:', error);

      // Revert the UI changes if the database operation failed
      setCommentLikes(prev => ({
        ...prev,
        [commentId]: isLiked
      }));

      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            like_count: isLiked ? comment.like_count + 1 : Math.max(0, comment.like_count - 1)
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply => {
              if (reply.id === commentId) {
                return {
                  ...reply,
                  like_count: isLiked ? reply.like_count + 1 : Math.max(0, reply.like_count - 1)
                };
              }
              return reply;
            })
          };
        }
        return comment;
      }));
    }
  };

  const insertEmoji = (emoji: string) => {
    if (replyingTo) {
      setReplyText(prev => prev + emoji);
      replyInputRef.current?.focus();
    } else {
      setNewComment(prev => prev + emoji);
      inputRef.current?.focus();
    }
  };

  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const updateCommentCount = () => {
    if (onCommentCountChange) {
      onCommentCountChange(videoId, comments.length);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments' as any)
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Remove comment from local state
      setComments(prev => {
        const newComments = prev.filter(comment => {
          if (comment.id === commentId) {
            return false;
          }
          // Also remove from replies
          if (comment.replies) {
            comment.replies = comment.replies.filter(reply => reply.id !== commentId);
          }
          return true;
        });

        // Update comment count in parent component
        if (onCommentCountChange) {
          onCommentCountChange(videoId, newComments.length);
        }
        return newComments;
      });

      setShowDeleteConfirm(false);
      setCommentToDelete(null);
      setLongPressedComment(null);

      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed.',
        className: 'bg-green-600 text-white border-green-700'
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive'
      });
    }
  };

  const handleLongPressStart = (commentId: string, isOwnComment: boolean) => {
    if (!isOwnComment) return;

    longPressTimer.current = setTimeout(() => {
      setLongPressedComment(commentId);
      setCommentToDelete(commentId);
      setShowDeleteConfirm(true);
    }, 800); // 800ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end">
      <div className="w-full bg-black rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            Comments {comments.length > 0 && `(${comments.length})`}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="text-white/60 mt-2">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/60">No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <>
              {comments.slice(0, 25).map((comment) => (
                <div key={comment.id} className="space-y-3">
                  <div className="flex gap-3">
                    <Avatar
                      className="w-8 h-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        if (comment.profiles?.username) {
                          onClose();
                          navigate(`/profile/${comment.profiles.username}`);
                        }
                      }}
                    >
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="bg-white/10 text-white text-xs">
                        {comment.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-white font-medium text-sm cursor-pointer hover:text-blue-400 transition-colors"
                          onClick={() => {
                            if (comment.profiles?.username) {
                              onClose();
                              navigate(`/profile/${comment.profiles.username}`);
                            }
                          }}
                        >
                          @{comment.profiles?.username || 'Unknown'}
                        </span>
                        <span className="text-white/50 text-xs">
                          {formatTime(comment.created_at)}
                        </span>
                      </div>
                      <p
                        className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap select-none"
                        onTouchStart={() => handleLongPressStart(comment.id, comment.user_id === user?.id)}
                        onTouchEnd={handleLongPressEnd}
                        onMouseDown={() => handleLongPressStart(comment.id, comment.user_id === user?.id)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                      >
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className="flex items-center gap-1 text-white/60 hover:text-red-500 transition-colors"
                        >
                          <Heart
                            size={14}
                            className={commentLikes[comment.id] ? 'text-red-500 fill-red-500' : ''}
                          />
                          <span className="text-xs">{comment.like_count || 0}</span>
                        </button>
                        <button
                          onClick={() => {
                            setReplyingTo(comment.id);
                            setTimeout(() => replyInputRef.current?.focus(), 100);
                          }}
                          className="text-white/60 hover:text-white text-xs transition-colors"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>

                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-11">
                      {/* View replies link */}
                      {!expandedReplies[comment.id] && (
                        <button
                          onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: true }))}
                          className="text-white/60 hover:text-white text-xs mb-3 transition-colors"
                        >
                          View replies ({comment.replies.length})
                        </button>
                      )}

                      {/* Show first 3 replies or all if expanded */}
                      {(expandedReplies[comment.id] ? comment.replies : comment.replies.slice(0, 3)).map((reply) => (
                        <div key={reply.id} className="flex gap-3 mb-3">
                          <Avatar
                            className="w-6 h-6 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              if (reply.profiles?.username) {
                                onClose();
                                navigate(`/profile/${reply.profiles.username}`);
                              }
                            }}
                          >
                            <AvatarImage src={reply.profiles?.avatar_url} />
                            <AvatarFallback className="bg-white/10 text-white text-xs">
                              {reply.profiles?.username?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-white font-medium text-sm cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => {
                                  if (reply.profiles?.username) {
                                    onClose();
                                    navigate(`/profile/${reply.profiles.username}`);
                                  }
                                }}
                              >
                                @{reply.profiles?.username || 'Unknown'}
                              </span>
                              <span className="text-white/50 text-xs">
                                {formatTime(reply.created_at)}
                              </span>
                            </div>
                            <p
                              className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap select-none"
                              onTouchStart={() => handleLongPressStart(reply.id, reply.user_id === user?.id)}
                              onTouchEnd={handleLongPressEnd}
                              onMouseDown={() => handleLongPressStart(reply.id, reply.user_id === user?.id)}
                              onMouseUp={handleLongPressEnd}
                              onMouseLeave={handleLongPressEnd}
                            >
                              {reply.content}
                            </p>
                            <button
                              onClick={() => handleLikeComment(reply.id)}
                              className="flex items-center gap-1 text-white/60 hover:text-red-500 transition-colors mt-2"
                            >
                              <Heart
                                size={14}
                                className={commentLikes[reply.id] ? 'text-red-500 fill-red-500' : ''}
                              />
                              <span className="text-xs">{reply.like_count || 0}</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Hide replies link if expanded and has more than 3 */}
                      {expandedReplies[comment.id] && comment.replies.length > 3 && (
                        <button
                          onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: false }))}
                          className="text-white/60 hover:text-white text-xs mb-3 transition-colors"
                        >
                          Hide replies
                        </button>
                      )}
                    </div>
                  )}
                  {replyingTo === comment.id && (
                    <div className="ml-11">
                      <div className="flex gap-2">
                        <Input
                          ref={replyInputRef}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to @${comment.profiles?.username}...`}
                          className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/50"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitReply(comment.id);
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyText.trim()}
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Send size={16} />
                        </Button>
                        <Button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-white/60 hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          {showEmojiPicker && (
            <div className="mb-3 bg-white/10 rounded-lg max-h-64 overflow-hidden">
              <div className="flex border-b border-white/10">
                {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveEmojiTab(key)}
                      className={`flex-1 p-3 flex items-center justify-center transition-colors ${activeEmojiTab === key
                        ? 'bg-white/20 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      <IconComponent size={20} />
                    </button>
                  );
                })}
              </div>
              <div className="p-3 max-h-48 overflow-y-auto">
                {activeEmojiTab === 'gifs' ? (
                  <div className="text-center py-8">
                    <p className="text-white/60 text-sm">GIF support coming soon!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-8 gap-2">
                    {EMOJI_CATEGORIES[activeEmojiTab]?.emojis.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => insertEmoji(emoji)}
                        className="text-xl hover:bg-white/10 rounded p-1 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-white/10 text-white text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/50"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                    setShowKeyboard(true);
                  } else {
                    setShowEmojiPicker(true);
                    setShowKeyboard(false);
                  }
                }}
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white"
              >
                {showKeyboard ? <Smile size={20} /> : <Keyboard size={20} />}
              </Button>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-black/90 rounded-lg max-w-sm w-full mx-4 border border-white/20">
            <div className="p-4">
              <h3 className="text-white font-semibold mb-2">Delete Comment</h3>
              <p className="text-white/70 text-sm mb-4">
                Are you sure you want to delete this comment? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setCommentToDelete(null);
                    setLongPressedComment(null);
                  }}
                  variant="outline"
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => commentToDelete && handleDeleteComment(commentToDelete)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsModal;