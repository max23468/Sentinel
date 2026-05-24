#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { sendTestEmail } from "./email.js";
import { writeInventoryReport } from "./report.js";
import { scanSite } from "./scan.js";
import { loadState } from "./storage.js";
import { formatScanSummary } from "./summary.js";

const program = new Command();

program
  .name("sentinel")
  .description("Monitor custom per cambiamenti su siti web pubblici.")
  .version("0.1.0")
  .option("-c, --config <path>", "Percorso config YAML", "sentinel.config.yml");

program
  .command("scan")
  .description("Esegue la scansione dei siti abilitati.")
  .option("--dry-run", "Esegue senza scrivere stato, snapshot, report o email.")
  .option("--site <id>", "Scansiona un solo sito.")
  .action(async (options: { dryRun?: boolean; site?: string }) => {
    await run(async () => {
      const config = await loadConfig(program.opts<{ config: string }>().config);
      const sites = config.sites.filter((site) => site.enabled && (!options.site || site.id === options.site));
      if (sites.length === 0) throw new Error("Nessun sito abilitato corrisponde alla richiesta.");

      let shouldFail = false;
      for (const site of sites) {
        const result = await scanSite(config, site, { dryRun: Boolean(options.dryRun) });
        printScanSummary(result);
        if (result.issues.some((issue) => issue.fatal)) shouldFail = true;
      }

      if (shouldFail) process.exitCode = 1;
    });
  });

program
  .command("report")
  .description("Genera un report inventario dallo stato locale.")
  .action(async () => {
    await run(async () => {
      const config = await loadConfig(program.opts<{ config: string }>().config);
      const state = await loadState(config);
      const reportPath = await writeInventoryReport(config, state);
      console.log(`Report generato: ${reportPath}`);
    });
  });

program
  .command("test-email")
  .description("Invia un'email di test usando un profilo SMTP.")
  .option("--profile <name>", "Profilo SMTP", "gmail")
  .action(async (options: { profile: string }) => {
    await run(async () => {
      const config = await loadConfig(program.opts<{ config: string }>().config);
      await sendTestEmail(config.email, options.profile);
      console.log(`Email di test inviata con profilo ${options.profile}.`);
    });
  });

await program.parseAsync();

async function run(callback: () => Promise<void>): Promise<void> {
  try {
    await callback();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function printScanSummary(result: Awaited<ReturnType<typeof scanSite>>): void {
  for (const line of formatScanSummary(result)) console.log(line);
}
