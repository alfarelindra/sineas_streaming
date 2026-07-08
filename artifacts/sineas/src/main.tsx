import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercept window.fetch to support VITE_API_URL and Ngrok bypass headers
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
  }

  const isApi = url.startsWith("/api/") || url === "/api";
  const apiUrl = import.meta.env.VITE_API_URL;
  
  let headersInit = init?.headers;
  if (!headersInit && input instanceof Request) {
    headersInit = input.headers;
  }
  const headers = new Headers(headersInit);

  if (isApi) {
    if (apiUrl) {
      const cleanApiUrl = apiUrl.replace(/\/+$/, "");
      const resolvedUrl = `${cleanApiUrl}${url}`;
      if (typeof input === "string") {
        input = resolvedUrl;
      } else if (input instanceof URL) {
        input = new URL(resolvedUrl);
      } else {
        input = new Request(resolvedUrl, input);
      }
    }
    headers.set("ngrok-skip-browser-warning", "true");
  }

  if (url.includes("ngrok-free.app") || (apiUrl && apiUrl.includes("ngrok-free.app") && isApi)) {
    headers.set("ngrok-skip-browser-warning", "true");
  }

  return originalFetch(input, {
    ...init,
    headers,
  });
};

createRoot(document.getElementById("root")!).render(<App />);
