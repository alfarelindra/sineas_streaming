import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Notification {
  id: string;
  type: "comment" | "like" | "system" | "follow";
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function NotificationBell({ overDark = true }: { overDark?: boolean }) {
  const { isSignedIn, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifs = [], refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      if (!isSignedIn) return [];
      const token = await getToken();
      const headers: HeadersInit = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/notifications", { headers });
      if (!res.ok) throw new Error("Gagal mengambil notifikasi");
      return res.json();
    },
    enabled: !!isSignedIn,
    refetchInterval: 15000, // Poll every 15s to keep notifications fresh
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const headers: HeadersInit = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Gagal menandai semua dibaca");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/notifications"] });
      const previousNotifs = queryClient.getQueryData<Notification[]>(["/api/notifications"]);
      if (previousNotifs) {
        queryClient.setQueryData<Notification[]>(
          ["/api/notifications"],
          previousNotifs.map((n) => ({ ...n, read: true }))
        );
      }
      return { previousNotifs };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousNotifs) {
        queryClient.setQueryData(["/api/notifications"], context.previousNotifs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpenToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      refetch();
    }
  };

  const unread = notifs.filter(n => !n.read).length;

  if (!isSignedIn) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpenToggle}
        className={`relative p-2 transition-colors ${overDark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-yellow-400 rounded-full text-[10px] text-blue-950 flex items-center justify-center font-bold px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-bold text-popover-foreground text-sm">Notifikasi</h3>
            {unread > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Belum ada notifikasi</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-border hover:bg-accent transition-colors ${!n.read ? "bg-yellow-400/10" : ""}`}
                >
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)}>
                      <p className="text-sm text-popover-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(n.time)}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm text-popover-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(n.time)}</p>
                    </>
                  )}
                  {!n.read && <div className="w-2 h-2 rounded-full bg-yellow-400 float-right mt-1" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
