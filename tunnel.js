const { spawn, execSync } = require("child_process");
const http = require("http");

console.log("=== Sineas Environment Automation Pipeline ===");

// 1. Start Ngrok Tunnel on port 8080 via npx
console.log("Starting Ngrok tunnel on port 8080 via npx...");

const cmd = "npx";
const args = ["-y", "ngrok", "http", "8080"];

console.log(`Spawning: ${cmd} ${args.join(" ")}`);
const ngrokProcess = spawn(cmd, args, { shell: true });

ngrokProcess.stdout.on("data", (data) => {
  const msg = data.toString().trim();
  // Filter out terminal redraws
  if (msg && !msg.includes("Tunnel Status") && !msg.includes("Web Interface")) {
    console.log(`[Ngrok]: ${msg}`);
  }
});

ngrokProcess.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`[Ngrok Error]: ${msg}`);
});

ngrokProcess.on("close", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Ngrok process exited unexpectedly with code ${code}`);
  }
});

// 2. Poll Ngrok local API to capture the public URL
const ngrokApiUrl = "http://127.0.0.1:4040/api/tunnels";
let attempts = 0;
const maxAttempts = 20;

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
    console.error("\nError: Could not retrieve Ngrok tunnel URL. Please ensure Ngrok can run on your system.");
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(1);
  }
  setTimeout(pollTunnels, 1500);
}

// Start polling after a short delay
setTimeout(pollTunnels, 3000);

// Helper to run commands and print output without blocking
function runCommand(command) {
  try {
    const output = execSync(command, { stdio: "pipe" });
    if (output) console.log(output.toString());
  } catch (err) {
    // If it's a Vercel error package or something, throw it so the parent handles it
    const errOutput = err.stdout?.toString() || err.stderr?.toString() || "";
    if (errOutput) console.error(errOutput);
    throw err;
  }
}

// 3. Update Environment Variables on Vercel
function updateVercelEnvironment(apiUrl) {
  console.log("\nUpdating Vercel environment variables...");
  
  try {
    // Remove old env var if it exists (ignore errors if it doesn't exist)
    console.log("Removing existing VITE_API_URL variable...");
    try {
      runCommand("vercel env rm VITE_API_URL production -y --non-interactive");
    } catch (e) {
      console.log("VITE_API_URL variable didn't exist or failed to remove, proceeding to add new one...");
    }

    // Add new env var
    console.log(`Adding new VITE_API_URL = ${apiUrl}...`);
    runCommand(`vercel env add VITE_API_URL production --value "${apiUrl}" --yes --non-interactive`);
    console.log("Environment variable successfully updated!");

    // Redeploy to Vercel
    console.log("\nTriggering production redeployment on Vercel...");
    runCommand("vercel --prod --force --yes --non-interactive");
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
