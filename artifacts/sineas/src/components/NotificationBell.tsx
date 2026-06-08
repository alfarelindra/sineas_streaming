import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";

interface Notification {
  id: string;
  type: "comment" | "like" | "system";
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = "sineas-notifications";

function getNotifications(): Notification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveNotifications(notifs: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
}

export function addNotification(notif: Omit<Notification, "id" | "read" | "time">) {
  const notifs = getNotifications();
  notifs.unshift({
    ...notif,
    id: Date.now().toString(),
    read: false,
    time: new Date().toISOString(),
  });
  saveNotifications(notifs.slice(0, 20));
  window.dispatchEvent(new Event("sineas-notification"));
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

export default function NotificationBell() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => setNotifs(getNotifications());

  useEffect(() => {
    refresh();
    window.addEventListener("sineas-notification", refresh);
    return () => window.removeEventListener("sineas-notification", refresh);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifs(updated);
  };

  const unread = notifs.filter(n => !n.read).length;

  if (!isSignedIn) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) refresh(); }}
        className="relative text-gray-300 hover:text-white p-2 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-950 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-bold text-white text-sm">Notifikasi</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Belum ada notifikasi</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read ? "bg-red-500/5" : ""}`}
                >
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)}>
                      <p className="text-sm text-white">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatTime(n.time)}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm text-white">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatTime(n.time)}</p>
                    </>
                  )}
                  {!n.read && <div className="w-2 h-2 rounded-full bg-red-500 float-right mt-1" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
