import { useListPlans, useGetSubscriptionStatus } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <Star className="w-6 h-6" />,
  premium: <Crown className="w-6 h-6" />,
  ultra: <Sparkles className="w-6 h-6" />,
};

const PLAN_COLORS: Record<string, string> = {
  basic: "from-blue-600/20 to-blue-800/10 border-blue-500/30",
  premium: "from-amber-600/20 to-amber-800/10 border-amber-500/30",
  ultra: "from-purple-600/20 to-purple-800/10 border-purple-500/30",
};

const PLAN_BUTTON: Record<string, string> = {
  basic: "bg-blue-600 hover:bg-blue-700",
  premium: "bg-amber-500 hover:bg-amber-600 text-black",
  ultra: "bg-purple-600 hover:bg-purple-700",
};

const POPULAR_PLAN = "premium";

/** Dynamically load Midtrans Snap.js from CDN */
function loadSnapScript(clientKey: string, isProduction: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("midtrans-snap-script");
    if (existingScript) { resolve(); return; }
    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Midtrans Snap.js"));
    document.head.appendChild(script);
  });
}

export default function Subscription() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const { data: plans, isLoading: loadingPlans } = useListPlans();
  const { data: status, refetch: refetchStatus } = useGetSubscriptionStatus();

  const handleSubscribe = useCallback(async (planId: string) => {
    if (!isSignedIn) {
      toast({ title: "Masuk terlebih dahulu", description: "Silakan masuk untuk berlangganan", variant: "destructive" });
      return;
    }

    setLoadingPlanId(planId);

    try {
      // Step 1: Create Snap transaction on our server
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/midtrans/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Midtrans belum dikonfigurasi" }));
        toast({
          title: "Pembayaran Tidak Tersedia",
          description: err.error ?? "Pastikan MIDTRANS_SERVER_KEY sudah diset di environment variables.",
          variant: "destructive",
        });
        return;
      }

      const { snapToken, clientKey, isProduction } = await res.json();

      // Step 2: Load Snap.js SDK dynamically
      await loadSnapScript(clientKey, isProduction);

      // Step 3: Open Snap payment popup
      (window as any).snap.pay(snapToken, {
        onSuccess: () => {
          toast({ title: "Pembayaran Berhasil! 🎉", description: "Langganan kamu sekarang aktif." });
          refetchStatus();
        },
        onPending: () => {
          toast({ title: "Menunggu Pembayaran", description: "Selesaikan pembayaran untuk mengaktifkan langganan." });
        },
        onError: (err: any) => {
          console.error("Snap payment error:", err);
          toast({ title: "Pembayaran Gagal", description: "Terjadi kesalahan. Silakan coba lagi.", variant: "destructive" });
        },
        onClose: () => {
          // User closed the popup without paying
        },
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setLoadingPlanId(null);
    }
  }, [isSignedIn, toast, refetchStatus]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 max-w-screen-xl mx-auto px-6 pb-24">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-blue-600/20 text-yellow-400 border-yellow-400/30">
            <Crown className="w-3 h-3 mr-1" />
            Berlangganan Sineas
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Nikmati Hiburan{" "}
            <span className="text-yellow-400">Tanpa Batas</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Pilih paket yang sesuai untukmu. Bayar mudah via Midtrans.
          </p>
        </div>

        {/* Current subscription status */}
        {isSignedIn && status?.isSubscribed && (
          <div className="mb-10 bg-green-500/10 border border-green-500/30 rounded-2xl p-6 max-w-md mx-auto text-center">
            <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h3 className="font-bold text-lg text-green-400">Langganan Aktif</h3>
            <p className="text-muted-foreground text-sm mt-1 capitalize">
              Paket: <span className="text-foreground font-medium">{status.plan}</span>
            </p>
            {status.currentPeriodEnd && (
              <p className="text-muted-foreground text-xs mt-1">
                Aktif hingga {new Date(status.currentPeriodEnd).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* Plans */}
        {loadingPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {(plans ?? []).map((plan: any) => {
              const isPopular = plan.tier === POPULAR_PLAN || plan.id === POPULAR_PLAN;
              const isCurrentPlan = status?.plan === plan.tier || status?.plan === plan.id;
              const colorClass = PLAN_COLORS[plan.tier ?? plan.id] ?? PLAN_COLORS.basic;
              const btnClass = PLAN_BUTTON[plan.tier ?? plan.id] ?? "bg-blue-600 hover:bg-blue-700";
              const thisPlanId = plan.tier ?? plan.id;
              const isLoadingThis = loadingPlanId === thisPlanId;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border bg-gradient-to-b p-6 flex flex-col ${colorClass} ${isPopular ? "scale-105 shadow-2xl shadow-amber-500/20" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-black font-bold text-xs px-3">
                        PALING POPULER
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl bg-muted ${isPopular ? "text-amber-400" : "text-muted-foreground"}`}>
                      {PLAN_ICONS[plan.tier ?? plan.id] ?? <Star className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-foreground">{plan.name}</h3>
                      {isCurrentPlan && (
                        <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                          Aktif
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-foreground">
                        {formatIDR(plan.amount).replace("Rp", "").trim()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Rp/bulan · dibatalkan kapan saja
                    </p>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {(plan.features ?? []).map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(thisPlanId)}
                    disabled={isCurrentPlan || isLoadingThis || loadingPlanId !== null}
                    className={`w-full font-bold ${isCurrentPlan ? "bg-muted text-muted-foreground cursor-not-allowed" : btnClass}`}
                  >
                    {isCurrentPlan ? "Paket Saat Ini" : isLoadingThis ? "Memuat..." : `Pilih ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Midtrans badge + notes */}
        <div className="mt-16 max-w-2xl mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Pembayaran aman melalui <span className="text-blue-400 font-semibold">Midtrans</span>. Semua harga dalam Rupiah Indonesia.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dengan berlangganan, kamu setuju dengan{" "}
            <span className="text-yellow-400 cursor-pointer">Syarat &amp; Ketentuan</span> Sineas.
          </p>
          {!isSignedIn && (
            <div className="mt-6">
              <Link href="/sign-in">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Masuk untuk Berlangganan
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

