import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { authApi } from "@/api/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OTP_LENGTH = 6; 

export function Auth() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      await authApi.requestOtp({ email });
      setStep("verify");
      setResendCooldown(350);
      setOtp(new Array(OTP_LENGTH).fill(""));
      
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      const msg = err.response?.data?.detail?.[0]?.msg || "Failed to request OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (completeOtpArray: string[]) => {
    setLoading(true);
    setError(null);
    const otpCode = completeOtpArray.join("");
    
    try {
      const { access_token } = await authApi.verifyOtp({ email, code: otpCode });
      await login(access_token);
      navigate("/", { replace: true }); 
    } catch (err: any) {
      const msg = err.response?.data?.detail?.[0]?.msg || "Invalid OTP. Please try again.";
      setError(msg);
      setOtp(new Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const { value } = e.target;
    const newOtp = [...otp];
    const digit = value.replace(/\D/g, "").slice(-1);
    
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== "")) {
      verifyOtp(newOtp);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-md shadow-lg border-muted/50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            {step === "request" ? "Welcome" : "OTP"}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {step === "request" 
              ? "Sign in or create an account with your email."
              : `Enter the code sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/20"
                  required 
                />
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full text-base" disabled={loading}>
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col space-y-6">
              <div className="flex justify-between items-center text-sm font-semibold text-muted-foreground px-1">
                <span>Verification Code</span>
                <span>{resendCooldown > 0 ? `00:${resendCooldown.toString().padStart(2, '0')}s` : "Ready"}</span>
              </div>
              
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    value={digit}
                    onChange={(e) => handleOtpChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    disabled={loading}
                    className={`w-[60px] h-[65px] bg-secondary/80 rounded-lg text-foreground text-center text-2xl font-semibold outline-none focus:ring-2 transition-all 
                        ${error ? 'ring-2 ring-destructive focus:ring-destructive' : 'focus:ring-primary'} 
                        ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    autoFocus={index === 0}
                    required
                  />
                ))}
              </div>

              <div className="h-5 text-start px-1">
                {error && <span className="text-destructive text-sm font-medium">{error}</span>}
                {loading && !error && <span className="text-muted-foreground text-sm font-medium">Verifying...</span>}
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <Button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={resendCooldown > 0 || loading}
                  variant={resendCooldown > 0 ? "secondary" : "default"}
                  className="w-full text-base font-semibold"
                >
                  Resend Code
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => {
                    setStep("request");
                    setOtp(new Array(OTP_LENGTH).fill(""));
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Back to email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
