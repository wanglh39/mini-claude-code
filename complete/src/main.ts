import { parseArgs, printHelp } from "./cli.js";
import { loadConfig } from "./config.js";
import { runAgentLoop } from "./agent-loop.js";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const config = loadConfig(args);
runAgentLoop(config);