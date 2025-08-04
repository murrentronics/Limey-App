import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Feed from "./pages/Feed";
import Trending from "./pages/Trending";
import Live from "./pages/Live";
import Profile from "./pages/Profile";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";
import EditProfile from "@/pages/EditProfile";
import Friends from "@/pages/Friends";
import Inbox from "@/pages/Inbox";
import Chat from "@/pages/Chat";
import Message from "@/pages/Message";
import NotFound from "./pages/NotFound";
import LinkAccount from "@/pages/LinkAccount";
import Wallet from "@/pages/Wallet";
import CreateVideoPage from "./pages/CreateVideoPage";
import Deactivated from "./pages/Deactivated";
import VideoShare from "./pages/VideoShare";
import Boost from "./pages/Boost";
import AdminDashboard from "./pages/AdminDashboard";
import AdStats from "./pages/AdStats";
import CampaignDetail from "./pages/CampaignDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/trending" element={<ProtectedRoute><Trending /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><Live /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/message/:username" element={<ProtectedRoute><Message /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/welcome" element={<Index />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/wallet/link" element={<ProtectedRoute><LinkAccount /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/create-video" element={<ProtectedRoute><CreateVideoPage /></ProtectedRoute>} />
            <Route path="/deactivated" element={<Deactivated />} />
            <Route path="/video/:videoId" element={<VideoShare />} />
            <Route path="/boost" element={<ProtectedRoute><Boost /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/ad-stats" element={<ProtectedRoute><AdStats /></ProtectedRoute>} />
            <Route path="/campaign/:campaignId" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
