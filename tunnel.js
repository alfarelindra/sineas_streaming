const { spawn, execSync } = require("child_process");
const http = require("http");

console.log("=== Sineas Environment Automation Pipeline ===");

// 1. Start Ngrok Tunnel on port 8080
console.log("Starting Ngrok tunnel on port 8080...");

let ngrokProcess;

try {
  ngrokProcess = spawn("ngrok", ["http", "8080"], { shell: true, stdio: "ignore" });
} catch (e) {
  console.log("Global 'ngrok' command failed to spawn, trying 'npx ngrok'...");
  ngrokProcess = spawn("npx", ["-y", "ngrok", "http", "8080"], { shell: true, stdio: "ignore" });
}

ngrokProcess.on("error", (err) => {
  console.log("Failed to start Ngrok process. Trying fallback to 'npx ngrok'...");
  ngrokProcess = spawn("npx", ["-y", "ngrok", "http", "8080"], { shell: true, stdio: "ignore" });
});

// 2. Poll Ngrok local API to capture the public URL
const ngrokApiUrl = "http://127.0.0.1:4040/api/tunnels";
let attempts = 0;
const maxAttempts = 15;

function pollTunnels() {
  attempts++;
  console.log(`Polling Ngrok API for tunnel URL (attempt ${attempts}/${maxAttempts})...`);
  
  http.get(ngrokApiUrl, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        const tunnel = parsed.tunnels.find(t => t.proto === "https" || t.public_url.startsWith("https"));
        
        if (tunnel && tunnel.public_url) {
          const publicUrl = tunnel.public_url;
          console.log(`\nSuccess! Public Ngrok URL captured: ${publicUrl}`);
          updateVercelEnvironment(publicUrl);
        } else {
          retryOrExit();
        }
      } catch (err) {
        retryOrExit();
      }
    });
  }).on("error", () => {
    retryOrExit();
  });
}

function retryOrExit() {
  if (attempts >= maxAttempts) {
    console.error("Error: Could not retrieve Ngrok tunnel URL. Is Ngrok installed and working?");
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(1);
  }
  setTimeout(pollTunnels, 1500);
}

// Start polling after a short delay
setTimeout(pollTunnels, 2000);

// 3. Update Environment Variables on Vercel
function updateVercelEnvironment(apiUrl) {
  console.log("\nUpdating Vercel environment variables...");
  
  try {
    // Remove old env var if it exists (ignore errors if it doesn't exist)
    console.log("Removing existing VITE_API_URL variable...");
    try {
      execSync("vercel env rm VITE_API_URL production -y", { stdio: "inherit" });
    } catch (e) {
      console.log("VITE_API_URL variable didn't exist or failed to remove, proceeding to add new one...");
    }

    // Add new env var
    console.log(`Adding new VITE_API_URL = ${apiUrl}...`);
    execSync(`vercel env add VITE_API_URL production --value "${apiUrl}" --yes`, { stdio: "inherit" });
    console.log("Environment variable successfully updated!");

    // Redeploy to Vercel
    console.log("\nTriggering production redeployment on Vercel...");
    execSync("vercel --prod --force", { stdio: "inherit" });
    console.log("\nRedeployment complete! Vercel is now building and deploying your changes.");
    console.log("\nKeep this script running to keep the Ngrok tunnel active.");
    console.log("Press Ctrl+C to close the tunnel and exit.");
  } catch (err) {
    console.error("\nError updating environment or redeploying to Vercel:");
    console.error(err.message);
    console.error("\nPlease make sure you are logged into Vercel CLI by running: vercel login");
    console.log("Closing Ngrok tunnel...");
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(1);
  }
}

// Handle exit cleanly
process.on("SIGINT", () => {
  console.log("\nClosing Ngrok tunnel and exiting...");
  if (ngrokProcess) ngrokProcess.kill();
  process.exit(0);
});
