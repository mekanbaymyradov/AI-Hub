import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail } from "lucide-react";
import { authApi } from "@/api/auth";
import { getErrorMessage } from "@/api/errors";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;
const EMPTY_OTP: string[] = Array(OTP_LENGTH).fill("");

const stepMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export function Auth() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [otp, setOtp] = useState(EMPTY_OTP);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const navigate = useNavigate();
  const { login } = useAuth();

  const requestCode = async () => {
    setPending("send");
    setError(null);
    try {
      await authApi.requestOtp({ email });
      // The server replaces any earlier code, so start again from empty boxes.
      setOtp(EMPTY_OTP);
      setResent(step === "code");
      setStep("code");
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the code. Please try again."));
    } finally {
      setPending(null);
    }
  };

  const verifyCode = async (digits: string[]) => {
    setPending("verify");
    setError(null);
    try {
      const { access_token } = await authApi.verifyOtp({ email, code: digits.join("") });
      await login(access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "That code didn't work. Please try again."));
      setOtp(EMPTY_OTP);
      inputRefs.current[0]?.focus();
    } finally {
      setPending(null);
    }
  };

  const handleOtpChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    // More than one digit means a paste or autofill, which spreads across the following boxes.
    const digits = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH - index).split("");
    const next = [...otp];
    if (digits.length === 0) next[index] = "";
    digits.forEach((digit, i) => {
      next[index + i] = digit;
    });

    setOtp(next);
    setError(null);
    setResent(false);
    if (digits.length > 0) inputRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) verifyCode(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if ((e.key === "Backspace" && !otp[index]) || e.key === "ArrowLeft") inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight") inputRefs.current[index + 1]?.focus();
  };

  const changeEmail = () => {
    setStep("email");
    setOtp(EMPTY_OTP);
    setError(null);
    setResent(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-50 transition-colors duration-200 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-zinc-300 dark:text-zinc-800"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 50% 50% at 50% 45%, black, transparent)",
        }}
      />

      <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
        <Link
          to="/"
          aria-label="AI-Hub home"
          className="transition-opacity hover:opacity-80"
        >
          <Logo className="text-base font-semibold" />
        </Link>
        <ThemeToggle />
      </header>

      {/* The bottom padding lifts the card slightly above center, where the eye expects it. */}
      <main className="relative flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <AnimatePresence mode="wait" initial={false}>
            {step === "email" ? (
              <motion.form
                key="email"
                {...stepMotion}
                onSubmit={(e) => {
                  e.preventDefault();
                  requestCode();
                }}
              >
                <div className="text-center">
                  <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
                    <img src="/favicon.svg" alt="" className="size-6 object-contain" />
                  </span>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Welcome to AI-Hub</h1>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Sign in or create an account with your email. No password needed.
                  </p>
                </div>

                <div className="mt-6 space-y-2">
                  <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    aria-invalid={error !== null}
                    className="h-11 rounded-xl px-3.5"
                    autoFocus
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="mt-2 text-sm font-medium text-red-500">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={pending !== null}
                  className="mt-5 h-11 w-full gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {pending === "send" ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.div key="code" {...stepMotion}>
                <div className="text-center">
                  <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Mail className="size-5" />
                  </span>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Check your email</h1>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Enter the 6-digit code we sent to
                    <br />
                    <span className="font-medium break-all text-zinc-900 dark:text-white">{email}</span>
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-6 gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      value={digit}
                      onChange={(e) => handleOtpChange(e, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      // Selecting the digit lets typing replace it instead of appending to it.
                      onFocus={(e) => e.target.select()}
                      readOnly={pending === "verify"}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1}`}
                      aria-invalid={error !== null}
                      autoFocus={index === 0}
                      className={cn(
                        "h-12 w-full min-w-0 rounded-xl border bg-zinc-50 text-center text-xl font-semibold text-zinc-900 outline-none transition-all dark:bg-zinc-950 dark:text-white",
                        error
                          ? "border-red-500 ring-2 ring-red-500/20"
                          : "border-zinc-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:focus:bg-zinc-900",
                        pending === "verify" && "opacity-50",
                      )}
                    />
                  ))}
                </div>

                {/* One line for every state, so the card doesn't change height as it switches. */}
                <p role="status" className="mt-3 flex h-5 items-center justify-center text-center text-xs font-medium">
                  {error ? (
                    <span className="text-red-500">{error}</span>
                  ) : pending === "verify" ? (
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Checking your code…
                    </span>
                  ) : resent ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3.5" />
                      New code sent. The old one no longer works.
                    </span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      The code works once and expires in 5 minutes.
                    </span>
                  )}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5 text-sm dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={changeEmail}
                    disabled={pending !== null}
                    className="inline-flex items-center gap-1.5 font-medium text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-white"
                  >
                    <ArrowLeft className="size-4" />
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={pending !== null}
                    className="font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {pending === "send" ? "Sending…" : "Resend code"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
