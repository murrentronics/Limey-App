import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username,
              display_name: username
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Account created!",
          description: "You can now sign in with your credentials",
        });
        
        // Switch to sign in after successful signup
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "Successfully signed in",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-lg p-8 border border-gray-800">
        {/* Limey Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-black border-4 border-green-500 flex items-center justify-center mb-4 relative">
            <span className="text-green-500 font-bold text-2xl">L</span>
            <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-pulse"></div>
          </div>
          <h1 className="text-2xl font-bold text-green-500">Limey</h1>
          <p className="text-sm text-gray-400">Trinidad & Tobago</p>
        </div>

        {/* Auth Form */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            {isSignUp ? "Join Limey" : "Welcome Back"}
          </h2>
          <p className="text-gray-400 text-sm">
            {isSignUp 
              ? "Create your creator account" 
              : "Sign in to your Limey account"
            }
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-green-500"
                required
              />
            </div>
          )}
          
          <div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-green-500"
              required
            />
          </div>
          
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-green-500"
              required
            />
          </div>

          {isSignUp && (
            <div>
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-green-500"
                required
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-3 mt-6"
            disabled={loading}
          >
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign in"}
          </Button>
        </form>

        {!isSignUp && (
          <div className="text-center mt-4">
            <button className="text-green-500 text-sm hover:underline">
              Forgot your password?
            </button>
          </div>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-green-500 text-sm hover:underline"
          >
            {isSignUp 
              ? "Already have an account? Sign in" 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;