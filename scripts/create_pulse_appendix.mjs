import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const SKILL_DIR = "/Users/zeniaharoon/.codex/plugins/cache/openai-primary-runtime/presentations/26.915.20218/skills/presentations";
const workspaceDir = "/Users/zeniaharoon/Documents/Scale and Coin/ScaleTechWeek";
const TMP_DIR = "/private/tmp/pulse-appendix-build";
const FINAL_PPTX = path.join(workspaceDir, "output", "presentation", "Pulse_Technical_Appendix_FINAL.pptx");
const RUNTIME_PYTHON = "/Users/zeniaharoon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs"),
).href);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

const font = resolvePresentationFont();
const P = { navy: "#112846", ink: "#132B4C", slate: "#58677B", pale: "#E9EDF3", cream: "#F8F5F1", line: "#C9D0DA", green: "#4FAE83", white: "#FFFFFF" };
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = presentation.slides.add();
slide.background.fill = P.cream;

function addBox({ left, top, width, height, fill = "none", line = "none", radius = false }) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left, top, width, height },
    fill,
    line: line === "none" ? { fill: "none", width: 0 } : { fill: line, width: 1.2 },
  });
}
function text(value, left, top, width, height, opts = {}) {
  const shape = addBox({ left, top, width, height, fill: "none", line: "none" });
  shape.text = value;
  shape.text.style = {
    typeface: font,
    fontSize: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? P.ink,
    autoFit: "shrinkText",
    verticalAlignment: opts.valign ?? "middle",
    alignment: opts.align ?? "left",
    marginLeft: opts.margin ?? 0,
    marginRight: opts.margin ?? 0,
    marginTop: 0,
    marginBottom: 0,
  };
  return shape;
}
function step(n, title, detail, x, y, w) {
  addBox({ left: x, top: y, width: w, height: 208, fill: P.pale, line: P.line, radius: true });
  addBox({ left: x + 22, top: y + 24, width: 42, height: 42, fill: P.navy, line: "none", radius: true });
  text(String(n), x + 22, y + 23, 42, 42, { size: 18, bold: true, color: P.white, align: "center" });
  text(title, x + 22, y + 84, w - 44, 28, { size: 23, bold: true });
  text(detail, x + 22, y + 124, w - 44, 54, { size: 17, color: P.slate, valign: "top" });
}

text("Technical appendix", 64, 42, 1150, 48, { size: 42, bold: true, color: "#000000" });
addBox({ left: 64, top: 112, width: 1152, height: 54, fill: P.navy, line: "none" });
text("Participant-specific seizure forecasting workflow", 82, 113, 1116, 52, { size: 23, color: P.white });

text("Data used in the research pathway", 72, 194, 455, 26, { size: 18, bold: true });
text("The wearable pilot provides heart-rate measurements and participant-reported event times. The product model expands this foundation with additional validated wearable signals.", 72, 230, 486, 69, { size: 18, color: P.slate, valign: "top" });

addBox({ left: 72, top: 332, width: 470, height: 160, fill: P.white, line: P.ink, radius: true });
addBox({ left: 72, top: 332, width: 470, height: 42, fill: P.navy, line: "none", radius: true });
text("Wearable Seizure Forecasting Pilot", 92, 337, 430, 31, { size: 19, bold: true, color: P.white });
text("Available inputs", 92, 396, 140, 22, { size: 16, bold: true });
text("Heart rate\nReported seizure-event times", 92, 424, 245, 52, { size: 17, color: P.slate, valign: "top" });
text("Public research dataset\n13 participant event files\n7 heart-rate files", 336, 396, 180, 78, { size: 15, color: P.slate, valign: "top" });

text("Forecast development", 600, 194, 500, 26, { size: 18, bold: true });
step(1, "Prepare", "Align sensor records to event labels. Check coverage and time zones.", 600, 234, 183);
step(2, "Personalize", "Estimate a personal baseline from heart-rate trends and time of day.", 806, 234, 183);
step(3, "Evaluate", "Train on earlier periods. Test on later periods before setting alerts.", 1012, 234, 183);

addBox({ left: 72, top: 536, width: 1123, height: 74, fill: P.white, line: P.line, radius: false });
text("Prototype scope", 92, 551, 165, 23, { size: 18, bold: true });
text("The current app visualizes a continuous risk score. A clinical model requires participant mapping, signal-quality review, temporal validation, and prospective study design.", 260, 548, 914, 31, { size: 17, color: P.slate, valign: "top" });

text("Sources: Wearable Seizure Forecasting Pilot, University of Melbourne (2023), CC BY-NC-SA 4.0.  Data quality context: Kjaer et al., Scientific Reports (2022).", 72, 647, 1050, 22, { size: 13, color: P.slate });
text("Appendix", 1100, 647, 95, 22, { size: 13, color: P.slate, align: "right" });

slide.speakerNotes.textFrame.setText("Sources: University of Melbourne, Wearable Seizure Forecasting Pilot (2023), https://figshare.unimelb.edu.au/articles/dataset/Wearable_Seizure_Forecasting_Pilot/23206445. Kjaer et al., Data quality evaluation in wearable monitoring, Scientific Reports (2022), https://pmc.ncbi.nlm.nih.gov/articles/PMC9741649/. The model-development statements describe a proposed research workflow and do not represent clinical performance claims.");

const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "Pulse_Technical_Appendix_candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

await finalizePresentation({
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Pulse_Technical_Appendix.validation.json"),
});

console.log(FINAL_PPTX);
