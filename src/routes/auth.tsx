
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EgoLogoMark } from "../components/ego/ego-brand";
import {
  useAuthStatus,
  useLoginOwner,
  useRegisterOwner,
  useResetLocalOwner,
} from "../lib/queries";
import { supabase } from "../lib/supabase";
import { ThemeToggleButton } from "../lib/theme";

export function AuthRoutePage() {
  const navigate = useNavigate();
  const { data: auth, isLoading } = useAuthStatus();
  const registerMutation = useRegisterOwner();
  const loginMutation = useLoginOwner();
  const resetOwnerMutation = useResetLocalOwner();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Owner Utama");
  const [supabaseAction, setSupabaseAction] = useState<"login" | "register">("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const [showResetPanel, setShowResetPanel] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetKeyword, setResetKeyword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [recoveryView, setRecoveryView] = useState<"none" | "request" | "password">("none");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryView("password");
        setFormError(null);
        setFormNotice(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    async function checkRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const isRecoveryLink =
        params.get("type") === "recovery" ||
        hashParams.get("type") === "recovery" ||
        params.has("code");

      if (!isRecoveryLink) return;

      // Supabase SDK memproses callback URL dan PKCE sesuai konfigurasi client.
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setFormError(error.message);
        return;
      }

      if (data.session) {
        setRecoveryView("password");
      } else {
        setFormError(
          "Sesi pemulihan tidak ditemukan. Silakan minta tautan pemulihan baru."
        );
      }
    }

    void checkRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (auth?.authenticated && recoveryView === "none") {
      void navigate({ to: "/" });
    }
  }, [auth?.authenticated, recoveryView, navigate]);

  const isSupabaseMode = auth?.mode === "supabase";
  const isRegistrationMode = isSupabaseMode
    ? supabaseAction === "register"
    : auth
      ? !auth.hasOwner
      : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    try {
      if (isRegistrationMode) {
        const res = await registerMutation.mutateAsync({
          email,
          password,
          full_name: fullName,
        });

        if (res.needsEmailConfirmation) {
          setFormNotice(
            `Pendaftaran berhasil. Silakan buka kotak masuk ${email.trim()} dan klik tautan konfirmasi dari Supabase sebelum masuk.`
          );
          setSupabaseAction("login");
          toast.success("Tautan konfirmasi telah dikirim ke email Anda.");
          return;
        }

        toast.success("Brankas pribadi Anda siap digunakan.");
      } else {
        await loginMutation.mutateAsync({ email, password });
        toast.success("Selamat datang kembali di brankas Anda.");
      }

      await navigate({ to: "/" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Autentikasi Owner gagal.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleRequestRecovery(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    if (!supabase) {
      setFormError("Koneksi Supabase belum tersedia.");
      return;
    }

    if (!email.trim()) {
      setFormError("Masukkan alamat email akun Anda.");
      return;
    }

    setRecoveryBusy(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth`,
        }
      );

      if (error) throw error;

      setFormNotice(
        "Jika email tersebut terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam."
      );
      toast.success("Permintaan pemulihan kata sandi diproses.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal mengirim tautan pemulihan.";
      setFormError(message);
      toast.error(message);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    if (!supabase) {
      setFormError("Koneksi Supabase belum tersedia.");
      return;
    }

    if (recoveryPassword.length < 6) {
      setFormError("Kata sandi minimal 6 karakter.");
      return;
    }

    if (recoveryPassword !== recoveryPasswordConfirm) {
      setFormError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setRecoveryBusy(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        throw new Error(
          "Sesi pemulihan tidak ditemukan atau sudah kedaluwarsa. Silakan minta tautan baru."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: recoveryPassword,
      });

      if (error) throw error;

      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      setRecoveryView("none");

      await supabase.auth.signOut();

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      setFormNotice(
        "Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru."
      );
      toast.success("Kata sandi berhasil diperbarui.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memperbarui kata sandi.";
      setFormError(message);
      toast.error(message);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handleResetLocalOwner(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);

    try {
      await resetOwnerMutation.mutateAsync({
        confirmed: resetConfirmed,
        confirmation_text: resetKeyword,
      });

      setShowResetPanel(false);
      setResetConfirmed(false);
      setResetKeyword("");
      setFormError(null);
      setEmail("");
      setPassword("");

      toast.success(
        "Akun Owner lama berhasil dihapus. Silakan daftar ulang dengan email yang benar."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus akun Owner.";
      setResetError(message);
      toast.error(message);
    }
  }

  const pending =
    registerMutation.isPending ||
    loginMutation.isPending ||
    resetOwnerMutation.isPending ||
    recoveryBusy;

  const inputClass =
    "min-h-[44px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#087BFF]/20 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]";

  const primaryButtonClass =
    "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#087BFF]/20 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19D8FF] disabled:opacity-60";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F4F7FB] px-4 py-10 transition-colors duration-200 dark:bg-[#040B1C]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#087BFF]/12 blur-3xl dark:bg-[#19D8FF]/12"
      />

      <div className="relative z-10 mb-4 flex w-full max-w-md justify-end">
        <ThemeToggleButton />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#DCE4F0] bg-white shadow-xl shadow-[#06132F]/8 dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
        <div className="ego-card-hero border-b border-[#1B3163] px-6 py-6 text-white sm:px-8">
          <div className="flex items-center gap-3.5">
            <EgoLogoMark size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  EGO Personal AI
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-[#19D8FF]/30 bg-[#19D8FF]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#19D8FF]">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Vault
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#C7D0E0]">
                Wealth Management &amp; Brankas Pribadi Single-Owner
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-600 dark:text-[#C7D0E0]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#087BFF] dark:text-[#19D8FF]" />
              <span>Menyiapkan brankas Anda...</span>
            </div>
          ) : recoveryView === "password" ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#06132F] dark:text-white">
                  Buat Kata Sandi Baru
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                  Masukkan kata sandi baru untuk akun EGO Anda.
                </p>
              </div>

              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={recoveryPassword}
                onChange={(e) => setRecoveryPassword(e.target.value)}
                placeholder="Kata sandi baru (minimal 6 karakter)"
                className={inputClass}
              />

              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={recoveryPasswordConfirm}
                onChange={(e) => setRecoveryPasswordConfirm(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className={inputClass}
              />

              {formError ? (
                <p role="alert" className="text-xs text-rose-600">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className={primaryButtonClass}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Simpan Kata Sandi Baru
              </button>
            </form>
          ) : recoveryView === "request" ? (
            <form onSubmit={handleRequestRecovery} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#06132F] dark:text-white">
                  Lupa Kata Sandi?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                  Masukkan email akun EGO. Kami akan mengirim tautan pemulihan.
                </p>
              </div>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email akun EGO"
                className={inputClass}
              />

              {formNotice ? (
                <p role="status" className="text-xs text-[#087BFF] dark:text-[#19D8FF]">
                  {formNotice}
                </p>
              ) : null}

              {formError ? (
                <p role="alert" className="text-xs text-rose-600">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className={primaryButtonClass}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Kirim Tautan Pemulihan
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecoveryView("none");
                  setFormError(null);
                  setFormNotice(null);
                }}
                className="w-full py-2 text-xs font-medium text-slate-600 underline dark:text-[#C7D0E0]"
              >
                Kembali ke halaman masuk
              </button>
            </form>
          ) : (
            <>
              {isSupabaseMode ? (
                <div
                  role="tablist"
                  aria-label="Mode autentikasi Supabase"
                  className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={supabaseAction === "login"}
                    onClick={() => {
                      setSupabaseAction("login");
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "login"
                        ? "bg-[#087BFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                    }`}
                  >
                    Masuk Owner
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={supabaseAction === "register"}
                    onClick={() => {
                      setSupabaseAction("register");
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className={`min-h-[40px] rounded-xl py-2 text-xs font-semibold transition-colors ${
                      supabaseAction === "register"
                        ? "bg-[#087BFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                    }`}
                  >
                    Daftar Owner Pertama
                  </button>
                </div>
              ) : null}

              <div className="mb-5 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs leading-relaxed text-slate-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                {isRegistrationMode ? (
                  <span>
                    <strong className="text-[#087BFF] dark:text-[#19D8FF]">
                      Selamat datang! Buat akun Owner pertama Anda:
                    </strong>{" "}
                    Sistem ini khusus untuk satu pemilik tunggal. Akun kedua akan ditolak otomatis demi privasi brankas.
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#06132F] dark:text-white">
                      Brankas Terkunci (Single-Owner):
                    </strong>{" "}
                    Masuk menggunakan kredensial Owner Anda untuk membuka akses.
                  </span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegistrationMode ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="owner-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                    >
                      Nama Panggilan / Owner
                    </label>
                    <input
                      id="owner-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Owner Utama"
                      className={inputClass}
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Email Owner
                  </label>
                  <input
                    id="owner-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@domain.id"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="owner-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Kata Sandi Brankas
                  </label>
                  <input
                    id="owner-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className={inputClass}
                  />
                </div>

                {formNotice ? (
                  <div
                    role="status"
                    className="rounded-xl border border-[#087BFF]/30 bg-[#087BFF]/10 px-3.5 py-2.5 text-xs font-medium text-[#087BFF] dark:border-[#19D8FF]/30 dark:bg-[#19D8FF]/10 dark:text-[#19D8FF]"
                  >
                    {formNotice}
                  </div>
                ) : null}

                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {formError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className={primaryButtonClass}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRegistrationMode ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {isRegistrationMode
                    ? "Daftarkan Owner Tunggal"
                    : "Buka Brankas Owner"}
                </button>
              </form>

              {isSupabaseMode && supabaseAction === "login" ? (
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryView("request");
                      setFormError(null);
                      setFormNotice(null);
                    }}
                    className="text-xs font-semibold text-[#087BFF] underline underline-offset-4 hover:text-[#0066E0] dark:text-[#19D8FF]"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
              ) : null}

              {!isSupabaseMode && !isRegistrationMode ? (
                <div className="mt-5 border-t border-[#DCE4F0] pt-4 dark:border-[#1B3163]">
                  <button
                    type="button"
                    aria-expanded={showResetPanel}
                    onClick={() => {
                      setShowResetPanel((v) => !v);
                      setResetError(null);
                    }}
                    className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-rose-700 dark:text-[#C7D0E0]/75 dark:decoration-[#1B3163] dark:hover:text-rose-300"
                  >
                    Email salah atau tidak bisa masuk? Hapus Akun Owner
                  </button>

                  {showResetPanel ? (
                    <form
                      onSubmit={handleResetLocalOwner}
                      className="mt-3 space-y-3 rounded-2xl border border-rose-200/90 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20"
                    >
                      <div className="flex items-start gap-2.5 text-xs leading-relaxed text-rose-900 dark:text-rose-200">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
                          aria-hidden="true"
                        />
                        <p>
                          Jika Anda salah memasukkan email saat pendaftaran atau lupa kata sandi, Anda dapat menghapus akun Owner saat ini untuk mendaftar ulang. Demi keamanan, seluruh data brankas lokal akan dikosongkan.
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-800 dark:text-[#C7D0E0]">
                        <input
                          type="checkbox"
                          checked={resetConfirmed}
                          onChange={(e) => setResetConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-rose-300 accent-rose-600"
                        />
                        <span>
                          Saya setuju menghapus akun Owner dan mengosongkan seluruh data brankas lokal saat ini.
                        </span>
                      </label>

                      <div className="space-y-1">
                        <label
                          htmlFor="reset-owner-keyword"
                          className="block text-xs font-medium text-slate-700 dark:text-[#C7D0E0]"
                        >
                          Ketik{" "}
                          <span className="font-mono font-semibold">HAPUS</span>{" "}
                          untuk konfirmasi
                        </label>
                        <input
                          id="reset-owner-keyword"
                          type="text"
                          value={resetKeyword}
                          onChange={(e) => setResetKeyword(e.target.value)}
                          placeholder="HAPUS"
                          autoComplete="off"
                          className={inputClass}
                        />
                      </div>

                      {resetError ? (
                        <div
                          role="alert"
                          className="rounded-xl border border-rose-300 bg-white/90 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-[#06132F] dark:text-rose-300"
                        >
                          {resetError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={resetOwnerMutation.isPending}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                        >
                          {resetOwnerMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Hapus Akun Owner &amp; Daftar Ulang
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowResetPanel(false);
                            setResetConfirmed(false);
                            setResetKeyword("");
                            setResetError(null);
                          }}
                          className="min-h-[38px] rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-2 border-t border-[#DCE4F0] pt-4 text-xs text-slate-500 dark:border-[#1B3163] dark:text-[#C7D0E0]/65">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#087BFF] dark:text-[#19D8FF]" />
                <span>
                  Penyimpanan:{" "}
                  {auth?.mode === "supabase"
                    ? "Supabase Cloud (RLS Aktif)"
                    : "Brankas Server Lokal (Siap Supabase)"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
