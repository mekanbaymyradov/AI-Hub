import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { authApi } from "@/api/auth";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <ThemeToggle />
      </div>
      <div className="absolute top-5 left-5">
        <Link to="/" className="flex items-center gap-2 text-zinc-900 dark:text-white font-semibold text-sm hover:opacity-80 transition-opacity">
          <BrainCircuit className="h-5 w-5 text-blue-600 dark:text-blue-500" />
          <span>AI<span className="text-blue-600 dark:text-blue-500">Hub</span></span>
        </Link>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 rounded-2xl backdrop-blur-md">
        <CardHeader className="text-center pt-8 pb-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 dark:border-blue-900/40">
            <BrainCircuit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {step === "request" ? "Welcome to AI-Hub" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription className="text-center text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {step === "request" 
              ? "Sign in or create an account with your email."
              : `We sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {step === "request" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300 font-medium text-xs">
                  Email Address
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus-visible:ring-blue-500"
                  required 
                />
              </div>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <Button 
                type="submit" 
                className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer" 
                disabled={loading}
              >
                {loading ? "Sending..." : "Continue with Email"}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col space-y-6">
              <div className="flex justify-between items-center text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">
                <span>Verification Code</span>
                <span>{resendCooldown > 0 ? `00:${resendCooldown.toString().padStart(2, '0')}s` : "Ready to resend"}</span>
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
                    className={`w-[52px] h-[60px] bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-center text-2xl font-semibold outline-none transition-all 
                        ${error ? 'border-red-500 ring-2 ring-red-500/20' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'} 
                        ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    autoFocus={index === 0}
                    required
                  />
                ))}
              </div>

              <div className="h-5 text-start px-1">
                {error && <span className="text-red-500 text-xs font-medium">{error}</span>}
                {loading && !error && <span className="text-zinc-500 text-xs font-medium">Verifying code...</span>}
              </div>

              <div className="flex flex-col gap-2.5 mt-2">
                <Button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={resendCooldown > 0 || loading}
                  className={cn(
                    "w-full h-10 text-sm font-semibold rounded-xl transition-all cursor-pointer",
                    resendCooldown > 0 
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed" 
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                  )}
                >
                  Resend Code
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full h-9 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-xl cursor-pointer" 
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
