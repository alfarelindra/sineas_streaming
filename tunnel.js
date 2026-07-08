const ngrok = require("ngrok");
const { execSync } = require("child_process");

console.log("=== Sineas Environment Automation Pipeline ===");

// Helper to run commands and print output without blocking
function runCommand(command) {
  try {
    const output = execSync(command, { stdio: "pipe" });
    if (output) console.log(output.toString());
  } catch (err) {
    const errOutput = err.stdout?.toString() || err.stderr?.toString() || "";
    if (errOutput) console.error(errOutput);
    throw err;
  }
}

// Update Environment Variables on Vercel
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
    runCommand(`vercel env add VITE_API_URL production "${apiUrl}" --non-interactive --yes`);
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
    cleanupAndExit();
  }
}

async function cleanupAndExit() {
  console.log("\nClosing Ngrok tunnel and exiting...");
  try {
    await ngrok.disconnect();
    await ngrok.kill();
  } catch (e) {}
  process.exit(0);
}

// Handle exit cleanly
process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);

(async function() {
  try {
    const authtoken = "3GELiKkhzbpN5s7LJX12YRvy2Ue_7CoEdm5mLfatW6CtvPctA";
    
    console.log("Configuring Ngrok authtoken...");
    await ngrok.authtoken(authtoken);

    console.log("Connecting Ngrok tunnel on port 8080...");
    const url = await ngrok.connect({
      proto: "http",
      addr: 8080,
    });

    console.log(`\nSuccess! Public Ngrok URL captured: ${url}`);
    updateVercelEnvironment(url);
  } catch (err) {
    console.error("Failed to connect Ngrok tunnel:", err);
    process.exit(1);
  }
})();
