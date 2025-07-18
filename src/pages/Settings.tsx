import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { deleteUserAccount } from "@/lib/ttpaypalApi";
import { ArrowLeft, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [user]);


  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSettings(data || {
        notification_settings: { likes: true, follows: true, comments: true },
        privacy_settings: { private_account: false },
        account_settings: { dark_mode: false }
      });

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...newSettings
        });

      if (error) throw error;

      setSettings(newSettings);
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully",
        className: "bg-green-600 text-white border-green-700"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      // Call the new function to delete the user account
      await deleteUserAccount(user.id);

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
        className: "bg-green-600 text-white border-green-700"
      });

      // Sign out and navigate to home
      await signOut();
      navigate("/");

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive"
      });
    }
  };


  const changePassword = async () => {
    if (!user) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully",
        className: "bg-green-600 text-white border-green-700"
      });

      // Reset form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-black text-primary tracking-wider logo-text-glow" style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: '900',
            letterSpacing: '0.15em',
            filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
          }}>
            Settings
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="likes">Likes</Label>
              <Switch
                id="likes"
                checked={settings?.notification_settings?.likes || false}
                onCheckedChange={(checked) =>
                  updateSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings,
                      likes: checked
                    }
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="follows">Follows</Label>
              <Switch
                id="follows"
                checked={settings?.notification_settings?.follows || false}
                onCheckedChange={(checked) =>
                  updateSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings,
                      follows: checked
                    }
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="comments">Comments</Label>
              <Switch
                id="comments"
                checked={settings?.notification_settings?.comments || false}
                onCheckedChange={(checked) =>
                  updateSettings({
                    ...settings,
                    notification_settings: {
                      ...settings.notification_settings,
                      comments: checked
                    }
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">********</div>
            </div>

            {showPasswordForm && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={changePassword}
                    disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
                    className="flex-1"
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="private">Private Account</Label>
              <Switch
                id="private"
                checked={settings?.privacy_settings?.private_account || false}
                onCheckedChange={(checked) =>
                  updateSettings({
                    ...settings,
                    privacy_settings: {
                      ...settings.privacy_settings,
                      private_account: checked
                    }
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Management */}
        <Card>
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
            
            {!deletionCountdown && (
              <Button
                onClick={handleDeleteAccount}
                variant="destructive"
                className="w-full"
              >
                <Trash2 size={16} className="mr-2" />
                Delete Account
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Settings;