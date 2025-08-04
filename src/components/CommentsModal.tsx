import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, Send, Smile, Heart, Keyboard, Coffee, Plane, Trophy, Shirt, Zap, MoreVertical } from 'lucide-react';
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
  highlightCommentId?: string; // ID of comment/reply to highlight
}

// Component to render comment content with GIF support
const CommentContent: React.FC<{ content: string }> = ({ content }) => {
  // Check if content contains GIF markdown syntax
  const gifRegex = /!\[GIF\]\((https?:\/\/[^\s)]+)\)/g;
  const parts = content.split(gifRegex);

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        // If this part is a URL (every odd index after split), render as GIF
        if (index % 2 === 1 && part.startsWith('http')) {
          return (
            <div key={index} className="my-2">
              <img
                src={part}
                alt="GIF"
                className="max-w-full h-auto rounded-lg max-h-48 object-contain"
                loading="lazy"
              />
            </div>
          );
        }
        // Otherwise render as text
        return part ? <span key={index}>{part}</span> : null;
      })}
    </div>
  );
};

// Simple GIF Picker Component
const GifPicker: React.FC<{ onGifSelect: (gifUrl: string) => void }> = ({ onGifSelect }) => {
  // Popular GIF URLs for quick access
  const popularGifs = [
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', // thumbs up
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // clapping
    'https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif', // laughing
    'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', // dancing
    'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', // heart eyes
    'https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif', // mind blown
    'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', // shocked
    'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', // happy
    'https://media.giphy.com/media/3o7aCSPqXE5C6T8tBC/giphy.gif', // love
    'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif', // cool
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif', // fire
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGZpMzA2cHRrZTBrbHptZWgxajBidW83YW9rMnk1b2lhdGQybWYyOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/nqT2V4HpFuomc/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGZpMzA2cHRrZTBrbHptZWgxajBidW83YW9rMnk1b2lhdGQybWYyOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8iOzrJARYNURO/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3OTN6dWo2OG9sMGU4amxqaGpkMTFnc3R3dGN3bjc4eG5vOG4zNzhrZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/eGl4ZnPBvOCkDqVLJo/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bHJ1amNjNTIzejl5bG1vc2dpMzl5NmF4MjN4cmM3ZXM0b2hlcnVlZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lnIZZfwNzeYow/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3bHJ1amNjNTIzejl5bG1vc2dpMzl5NmF4MjN4cmM3ZXM0b2hlcnVlZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26CaLKiimsm3ibpE4/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/VyB31XTqZNJhFRZNyl/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ljuSksqL9j0yI/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6WFScxN6fi95z3YVQD/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xSlDYEXknFwY4ucrZV/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wGKrkvHxZT6PVpw635/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdnaXRkdXMwb3JkZ294Mmp1eHppbDltc3N6OGI1OHV0Zzh3Mmx4cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wel1vvgXM2a7hRWttF/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9tamZwbGVna3JjanB6NGxlbzliYXl2MmhmZ3Y1eGxpcndxZzFtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WXB88TeARFVvi/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9tamZwbGVna3JjanB6NGxlbzliYXl2MmhmZ3Y1eGxpcndxZzFtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ZGU890vUpxuOKjKcpZ/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9tamZwbGVna3JjanB6NGxlbzliYXl2MmhmZ3Y1eGxpcndxZzFtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8lgqAbycBjosxjfi9k/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9tamZwbGVna3JjanB6NGxlbzliYXl2MmhmZ3Y1eGxpcndxZzFtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/okfvUCpgArv3y/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9tamZwbGVna3JjanB6NGxlbzliYXl2MmhmZ3Y1eGxpcndxZzFtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cjnErkOZtvq5sHTM7c/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MndhNWR6YmE3eWU3eTl0YXNrMnF0bXV6bDhnaXZkdDlobzhsMGg2ZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ES9osccp5aUdq/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3M3k1ZmUxMXd6bzFzZGVjMzNhdm95Ym84eDh0MjU3aDZtb3FneXNwbiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/286RXzjX37vtZOwXQq/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3NGVmOWw4bnRrdTZiaWJrajE1MDRkZGt5Mzg5dTc3bHFxZGRkbW01YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/IVIRMpSAlSnHq/giphy.gif',
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHQydGR4ZXUyY25mM3JiczUzbmtoYmlnMW5vMWQ4ZTl2dGh6aDd0NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/nGEO47ShV3Us0/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RvenM4Y2lyNTdwaXBpa2VkODQ3ejl3NmttemVvam9iaWh6MHE3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/bECCppRU0yRiS0iVJH/giphy.gif',
    'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXpmbHNlajF4MDRuN3d1cHhjZngyNWUwaXM3a3gyM3YxOWRlaXY5cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/WeiYU1ea1Poqs/giphy.gif',
    'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZXY1Y2c0NmV2MXdob200MnNmbzdlc3d2MG16c21vbHVlZ3I2NWV3eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2D8g2rXcWx1DO/giphy.gif',
    'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW1xOHAyZXFlbDI0azB4cDd1eG1uMzNlbnVieGg2dm11NnAzMGdzbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dhz1gKi7WKWpW/giphy.gif',
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmtoOTNlengybTZjc3dubWRvYWMzNHg5eWxrcXZtdTZsdjV6NHIwcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7waKDy5RbDYVG/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cnBuejd0M2xxM21mcjE4bmR6eXpqdHIzdmx6ZXdvZmMxcjNucG40aiZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/zIwAuqRp2Ki7S/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cnBuejd0M2xxM21mcjE4bmR6eXpqdHIzdmx6ZXdvZmMxcjNucG40aiZlcD12MV9naWZzX3JlbGF0ZWQmY3Q9Zw/A7ZbCuv0fJ0POGucwV/giphy.gif',
    'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXp4YWprbDJsbnAxNXloYWVyenNmYWs1cXJucW1ncHc4emxocTEycyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5t3fgYmnNfRICx34Wj/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RvenM4Y2lyNTdwaXBpa2VkODQ3ejl3NmttemVvam9iaWh6MHE3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jkRTu2tTfpwJbwvZz3/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RvenM4Y2lyNTdwaXBpa2VkODQ3ejl3NmttemVvam9iaWh6MHE3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cE5TH06rukeFIHbaKs/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RvenM4Y2lyNTdwaXBpa2VkODQ3ejl3NmttemVvam9iaWh6MHE3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/CWBgyqeF5344RsP4b9/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3anh6bzh6bzd6cGhzeDZsNzRubjRkY3phaWVqaWtyazVzOGZxeDF6aCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/QZsDxgHYw3VpLDubUS/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RvenM4Y2lyNTdwaXBpa2VkODQ3ejl3NmttemVvam9iaWh6MHE3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8CuA9BgLtQs3pBFF1J/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3anh6bzh6bzd6cGhzeDZsNzRubjRkY3phaWVqaWtyazVzOGZxeDF6aCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/9zylPz0kQKzmAWydBi/giphy.gif',

  ];

  const handleGifSelect = (gifUrl: string) => {
    try {
      onGifSelect(`![GIF](${gifUrl})`);
    } catch (error) {
      console.error('Error selecting GIF:', error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
        {popularGifs.map((gifUrl, index) => (
          <button
            key={index}
            onClick={() => handleGifSelect(gifUrl)}
            className="relative aspect-square rounded overflow-hidden hover:opacity-80 hover:scale-105 transition-all bg-white/10"
            title="Click to insert GIF"
          >
            <img
              src={gifUrl}
              alt="GIF"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <p className="text-white/50 text-xs text-center">
        Click a GIF to insert it into your comment
      </p>
    </div>
  );
};

const EMOJI_CATEGORIES = {
  smileys: {
    icon: Smile,
    name: 'Smileys & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '😎', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
      '🥳', '🤫', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
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
      '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻',
      '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍼', '🥛'
    ]
  },
  travel: {
    icon: Plane,
    name: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚎', '🏎️', '🚓', '🚑',
      '🚒', '🚐', '🚚', '🚛', '🚜', '🏍️', '🛵',
      '🚲', '🛴', '🚁', '🛸', '✈️', '🛩️',
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
      '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
      '🥊', '🥋', '🎽', '🛷', '⛸️', '🥌', '🎿',
      '⛷️', '🏂', '🏋️‍♀️', '🏋️‍♂️', '🤼‍♀️', '🤼‍♂️', '🤸‍♀️',
      '🤸‍♂️', '⛹️‍♀️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾‍♂️', '🏌️‍♀️', '🏌️‍♂️',
      '🏇', '🧘‍♀️', '🧘‍♂️', '🏄‍♀️', '🏄‍♂️', '🏊‍♀️', '🏊‍♂️', '🤽‍♀️',
      '🤽‍♂️', '🚣‍♂️', '🧗‍♀️', '🧗‍♂️', '🚵‍♀️', '🚵‍♂️', '🚴‍♀️'
    ]
  },
  objects: {
    icon: Shirt,
    name: 'Objects & Symbols',
    emojis: [
      '👑', '🎩', '🧢', '⛑️', '📿', '💄', '💍',
      '💎', '🔇', '🔈', '🔉', '🔊', '📢', '📣', '📯',
      '🔔', '🔕', '🎼', '🎵', '🎶', '🎙️', '🎚️', '🎛️',
      '🎧', '📻', '🎷', '🎸', '🎹', '🎺',
      '🎻', '🪕', '🥁', '📱', '📲', '☎️', '📞',
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

const CommentsModal: React.FC<CommentsModalProps> = ({ isOpen, onClose, videoId, videoTitle, onCommentCountChange, highlightCommentId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [showFullscreenComments, setShowFullscreenComments] = useState(false);
  const [commentLikes, setCommentLikes] = useState<{ [key: string]: boolean }>({});

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<{ [key: string]: boolean }>({});
  const [highlightedComment, setHighlightedComment] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const commentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchCurrentUserProfile();
    }
  }, [isOpen, videoId]);

  const fetchCurrentUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, display_name')
        .eq('user_id', user.id)
        .single();

      if (!error && profile) {
        setCurrentUserProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching current user profile:', error);
    }
  };

  // SIMPLE highlighting - exactly what you asked for
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      try {
        highlightSpecificComment(highlightCommentId);
      } catch (error) {
        console.error('Error highlighting comment:', error);
      }
    }
  }, [highlightCommentId, comments]);

  // Subscribe to current user profile changes
  useEffect(() => {
    if (!user) return;

    const profilesChannel = supabase
      .channel('current_user_profile_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new) {
          setCurrentUserProfile(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [user]);

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

      // Use any type to avoid deep type instantiation issues
      const typedCommentsData = commentsData as any[];

      const userIds = [...new Set(typedCommentsData.map(comment => comment.user_id))];

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
        typedCommentsData.map(async (comment) => {
          // Get accurate like count from comment_likes table
          const { data: likesData, error: likesError } = await supabase
            .from('comment_likes' as any)
            .select('id')
            .eq('comment_id', comment.id);

          // Use any type to avoid deep type instantiation issues
          const typedLikesData = likesData as any[] | null;
          const actualLikeCount = likesError ? 0 : (typedLikesData?.length || 0);

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

          // Use any type to avoid deep type instantiation issues
          const typedReplies = (replies || []) as any[];

          const repliesWithProfiles = await Promise.all(typedReplies.map(async (reply) => {
            // Get accurate like count for replies too
            const { data: replyLikesData, error: replyLikesError } = await supabase
              .from('comment_likes' as any)
              .select('id')
              .eq('comment_id', reply.id);

            // Use any type to avoid deep type instantiation issues
            const typedReplyLikesData = replyLikesData as any[] | null;
            const replyActualLikeCount = replyLikesError ? 0 : (typedReplyLikesData?.length || 0);

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

        // Use any type to avoid deep type instantiation issues
        const typedLikesData = likesData as any[] | null;

        const likesMap = (typedLikesData || []).reduce((acc, like) => {
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
        return newComments;
      });

      // Update comment count in parent component
      if (onCommentCountChange) {
        onCommentCountChange(videoId, comments.length + 1);
      }
      setNewComment('');

      await supabase.rpc('increment_comment_count' as any, { video_uuid: videoId });

      // Optional: Notify video owner about new comment (if different from commenter)
      try {
        const { data: videoData } = await supabase
          .from('videos')
          .select('user_id')
          .eq('id', videoId)
          .single();

        if (videoData && videoData.user_id !== user.id) {
          const currentUserProfile = userProfile || { username: user.email?.split('@')[0] || 'Someone' };
          console.log('Sending video comment notification to video owner:', videoData.user_id);

          const { error: notificationError } = await supabase
            .from('system_notifications' as any)
            .insert({
              to_user_id: videoData.user_id,
              from_user_id: user.id,
              type: 'video_comment',
              title: 'New comment on your video',
              message: `@${currentUserProfile.username} commented on your video`,
              video_id: videoId
              // TODO: Add comment_id: data.id when database schema is updated
            });

          if (notificationError) {
            console.error('Failed to send video comment notification:', notificationError);
          } else {
            console.log('Video comment notification sent successfully');
          }
        } else {
          console.log('No video comment notification needed (same user or no video data)');
        }
      } catch (notificationError) {
        console.warn('Failed to send video comment notification:', notificationError);
        // Don't fail the comment posting if notification fails
      }

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

      // Send notifications to all users in the comment thread
      const parentComment = comments.find(c => c.id === parentId);
      if (parentComment) {
        // Get all unique user IDs who have participated in this comment thread
        const threadParticipants = new Set<string>();

        // Add the original comment author
        threadParticipants.add(parentComment.user_id);

        // Add all reply authors
        if (parentComment.replies) {
          parentComment.replies.forEach(reply => {
            threadParticipants.add(reply.user_id);
          });
        }

        // Remove the current user (don't notify themselves)
        threadParticipants.delete(user.id);

        // Get usernames for the participants
        const participantIds = Array.from(threadParticipants);
        if (participantIds.length > 0) {
          const { data: participantProfiles } = await supabase
            .from('profiles')
            .select('user_id, username')
            .in('user_id', participantIds);

          const currentUserProfile = userProfile || { username: user.email?.split('@')[0] || 'Someone' };

          // Send notifications to all thread participants
          const notifications = participantIds.map(participantId => {
            const isOriginalAuthor = participantId === parentComment.user_id;
            const participantProfile = participantProfiles?.find(p => p.user_id === participantId);

            return {
              to_user_id: participantId,
              from_user_id: user.id,
              type: isOriginalAuthor ? 'comment_reply' : 'comment_thread_activity',
              title: isOriginalAuthor ? 'New reply to your comment' : 'New activity in followed thread',
              message: isOriginalAuthor
                ? `@${currentUserProfile.username} replied to your comment`
                : `@${currentUserProfile.username} replied in a comment thread you're following`,
              video_id: videoId
              // TODO: Add comment_id: data.id when database schema is updated
            };
          });

          if (notifications.length > 0) {
            console.log('Sending notifications to:', notifications.length, 'users');
            try {
              const { error: notificationError } = await supabase
                .from('system_notifications' as any)
                .insert(notifications);

              if (notificationError) {
                console.error('Failed to send thread notifications:', notificationError);
                // Don't fail the reply if notifications fail
              } else {
                console.log('Thread notifications sent successfully');
              }
            } catch (notificationError) {
              console.error('Exception sending thread notifications:', notificationError);
              // Don't fail the reply if notifications fail
            }
          } else {
            console.log('No notifications to send (no other participants)');
          }
        }
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

  // Simple function to highlight a specific comment - EXACTLY what you asked for
  const highlightSpecificComment = (commentId: string) => {
    try {
      console.log('Highlighting comment:', commentId);

      // 1. Click "See all comments" - show fullscreen
      setShowFullscreenComments(true);

      // 2. Find and expand parent thread if it's a reply
      comments.forEach(comment => {
        if (comment.replies) {
          const replyFound = comment.replies.find(reply => reply.id === commentId);
          if (replyFound) {
            setExpandedReplies(prev => ({ ...prev, [comment.id]: true }));
          }
        }
      });

      // 3. Highlight and scroll after a short delay
      setTimeout(() => {
        try {
          setHighlightedComment(commentId);

          const commentElement = commentRefs.current[commentId];
          if (commentElement) {
            commentElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });

            // 4. Remove highlight after 3 seconds (fade away)
            setTimeout(() => {
              setHighlightedComment(null);
            }, 3000);
          }
        } catch (scrollError) {
          console.error('Error scrolling to comment:', scrollError);
        }
      }, 500);
    } catch (error) {
      console.error('Error in highlightSpecificComment:', error);
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
        return newComments;
      });

      // Update comment count in parent component
      if (onCommentCountChange) {
        onCommentCountChange(videoId, comments.length - 1);
      }

      setShowDeleteConfirm(false);
      setCommentToDelete(null);

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



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-end">
      <div className="w-full bg-black rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {showFullscreenComments && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFullscreenComments(false)}
                className="text-white hover:bg-white/10"
              >
                ←
              </Button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                Comments {comments.length > 0 && `(${comments.length})`}
              </h2>
              {comments.length > 0 && !showFullscreenComments && (
                <p className="text-xs text-white/60 mt-1">Most recent</p>
              )}
              {showFullscreenComments && (
                <p className="text-xs text-white/60 mt-1">All comments</p>
              )}
            </div>
          </div>
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
              {/* Show only 5 most recent comments in compact view */}
              {(!showFullscreenComments ? comments.slice(0, 5) : comments).map((comment) => (
                <div
                  key={comment.id}
                  ref={(el) => commentRefs.current[comment.id] = el}
                  className={`space-y-3 transition-all duration-500 rounded-lg p-2 ${highlightedComment === comment.id
                    ? 'bg-green-500/20 border-2 border-green-500 shadow-lg'
                    : ''
                    }`}
                >
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
                      <div className="text-white/90 text-sm leading-relaxed select-none">
                        <CommentContent content={comment.content} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4">
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
                        {comment.user_id === user?.id && (
                          <button
                            onClick={() => {
                              setCommentToDelete(comment.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="text-white/60 hover:text-white transition-colors p-1"
                          >
                            <MoreVertical size={14} />
                          </button>
                        )}
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
                        <div
                          key={reply.id}
                          ref={(el) => commentRefs.current[reply.id] = el}
                          className={`flex gap-3 mb-3 transition-all duration-500 rounded-lg p-2 ${highlightedComment === reply.id
                            ? 'bg-green-500/20 border-2 border-green-500 shadow-lg'
                            : ''
                            }`}
                        >
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
                            <div className="text-white/90 text-sm leading-relaxed select-none">
                              <CommentContent content={reply.content} />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <button
                                onClick={() => handleLikeComment(reply.id)}
                                className="flex items-center gap-1 text-white/60 hover:text-red-500 transition-colors"
                              >
                                <Heart
                                  size={14}
                                  className={commentLikes[reply.id] ? 'text-red-500 fill-red-500' : ''}
                                />
                                <span className="text-xs">{reply.like_count || 0}</span>
                              </button>
                              {reply.user_id === user?.id && (
                                <button
                                  onClick={() => {
                                    setCommentToDelete(reply.id);
                                    setShowDeleteConfirm(true);
                                  }}
                                  className="text-white/60 hover:text-white transition-colors p-1"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              )}
                            </div>
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

              {/* See all comments link - only show if there are more than 5 comments and not in fullscreen */}
              {!showFullscreenComments && comments.length > 5 && (
                <div className="text-center py-4">
                  <button
                    onClick={() => setShowFullscreenComments(true)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    See all {comments.length} comments
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Comment input - always available */}
        <div className="p-4 border-t border-white/10">
          {showEmojiPicker && (
            <div className="mb-3 bg-white/10 rounded-lg max-h-64 overflow-hidden">
              <div className="flex border-b border-white/10">
                {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveEmojiTab(key as keyof typeof EMOJI_CATEGORIES)}
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
                  <GifPicker onGifSelect={(gifUrl) => insertEmoji(gifUrl)} />
                ) : (
                  <div className="grid grid-cols-8 gap-2">
                    {(EMOJI_CATEGORIES[activeEmojiTab]?.emojis || []).map((emoji, index) => (
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
              <AvatarImage src={currentUserProfile?.avatar_url || user?.user_metadata?.avatar_url || undefined} />
              <AvatarFallback className="bg-white/10 text-white text-xs">
                {currentUserProfile?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[101] bg-black/80 flex items-center justify-center p-4">
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
    </div>
  );
};

export default CommentsModal;