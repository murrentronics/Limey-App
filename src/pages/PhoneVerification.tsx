import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import LimeyLogo from "@/components/LimeyLogo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, Shield, Clock } from "lucide-react";

const PhoneVerification = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Countdown timer for resend button
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  // Check if user is already verified
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user || authLoading) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_verified, phone_number')
          .eq('user_id', user.id)
          .single();

        if (profile?.phone_verified) {
          navigate("/");
        } else if (profile?.phone_number) {
          setPhoneNumber(profile.phone_number);
          setStep("code");
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
      }
    };

    checkVerificationStatus();
  }, [user, authLoading, navigate]);

  const validateTrinidadPhone = (phone: string) => {
    // Remove any spaces, dashes, or parentheses
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Check if it starts with 1868 and has 11 digits total
    const trinidadPattern = /^1868\d{7}$/;
    return trinidadPattern.test(cleanPhone);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.length >= 4) {
      return `+${cleanPhone.slice(0, 4)} ${cleanPhone.slice(4)}`;
    }
    return cleanPhone;
  };

  const sendVerificationCode = async () => {
    if (!validateTrinidadPhone(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Trinidad & Tobago phone number (1868XXXXXXX)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Generate a 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the code and phone number in the database
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: phoneNumber,
          verification_code: code,
          verification_code_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          phone_verified: false
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      // In a real app, you would send SMS here
      // For now, we'll just show the code in console (development only)
      console.log(`Verification code for ${phoneNumber}: ${code}`);
      
      toast({
        title: "Verification Code Sent",
        description: `A 6-digit code has been sent to ${formatPhoneNumber(phoneNumber)}`,
        className: "bg-green-600 text-white border-green-700"
      });

      setStep("code");
      setCountdown(60); // 60 second countdown
      setCanResend(false);
    } catch (error) {
      console.error('Error sending verification code:', error);
      toast({
        title: "Error",
        description: "Failed to send verification code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit verification code",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Check the verification code
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('verification_code, verification_code_expires')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (!profile?.verification_code) {
        toast({
          title: "No Code Found",
          description: "Please request a new verification code",
          variant: "destructive"
        });
        return;
      }

      // Check if code has expired
      if (new Date() > new Date(profile.verification_code_expires)) {
        toast({
          title: "Code Expired",
          description: "The verification code has expired. Please request a new one.",
          variant: "destructive"
        });
        return;
      }

      // Check if code matches
      if (profile.verification_code !== verificationCode) {
        toast({
          title: "Invalid Code",
          description: "The verification code is incorrect. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Mark phone as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone_verified: true,
          verification_code: null,
          verification_code_expires: null
        })
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      toast({
        title: "Phone Verified!",
        description: "Your phone number has been successfully verified.",
        className: "bg-green-600 text-white border-green-700"
      });

      // Redirect to main app
      navigate("/");
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Only allow numbers and ensure it starts with 1868
    const cleanValue = value.replace(/\D/g, '');
    
    if (cleanValue.length === 0) {
      setPhoneNumber("");
    } else if (cleanValue.length <= 11) {
      // Auto-add 1868 prefix if user starts typing
      if (cleanValue.length <= 4 && !cleanValue.startsWith('1868')) {
        setPhoneNumber('1868' + cleanValue);
      } else {
        setPhoneNumber(cleanValue);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <LimeyLogo showCircle={true} wordmark={true} />
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              {step === "phone" ? <Phone className="w-6 h-6 text-primary" /> : <Shield className="w-6 h-6 text-primary" />}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {step === "phone" ? "Verify Your Phone" : "Enter Verification Code"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {step === "phone" 
              ? "We need to verify your Trinidad & Tobago phone number to continue"
              : `Enter the 6-digit code sent to ${formatPhoneNumber(phoneNumber)}`
            }
          </p>
        </div>

        {step === "phone" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  +
                </span>
                <Input
                  type="tel"
                  placeholder="1868XXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="pl-8"
                  maxLength={11}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Trinidad & Tobago numbers only (must start with 1868)
              </p>
            </div>

            <Button 
              onClick={sendVerificationCode} 
              className="w-full" 
              disabled={loading || !validateTrinidadPhone(phoneNumber)}
            >
              {loading ? "Sending Code..." : "Send Verification Code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Verification Code
              </label>
              <Input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>

            <Button 
              onClick={verifyCode} 
              className="w-full" 
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("phone");
                  setVerificationCode("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Change Phone Number
              </Button>
            </div>

            <div className="text-center">
              {!canResend ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Resend code in {countdown}s</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={sendVerificationCode}
                  disabled={loading}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Resend Code
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <p>
            By verifying your phone number, you agree to receive SMS messages from Limey.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PhoneVerification;