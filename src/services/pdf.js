const FOREST = [15, 81, 50];
const FOREST_DARK = [11, 61, 38];
const INK = [30, 34, 38];
const MUTED = [110, 118, 124];

function pageBreak(doc, cursorY, margin, minSpace) {
  if (cursorY > doc.internal.pageSize.getHeight() - minSpace) {
    doc.addPage();
    return margin;
  }
  return cursorY;
}

function drawHeader(doc, title, tagline) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, width, 96, "F");
  doc.setFillColor(...FOREST_DARK);
  doc.rect(0, 92, width, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("EcoMind", 40, 42);

  doc.setFontSize(15);
  doc.text(title, 40, 66);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 235, 226);
  doc.text(tagline, 40, 82);
}

function slugify(value) {
  return String(value ?? "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "download";
}

export async function downloadItemPdf(item, userName = "EcoMind User", redeemedAt = new Date()) {
  if (!item?.content) {
    throw new Error("This item has no downloadable content.");
  }

  const { jsPDF } = await import("jspdf");

  const margin = 40;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const contentWidth = width - margin * 2;

  const dateLabel = new Date(redeemedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  if (item.content.kind === "certificate") {
    drawHeader(doc, item.content.tagline ?? item.name, item.content.note ?? "");
    drawCertificate(doc, item, userName, dateLabel);
  } else {
    drawHeader(doc, item.name, item.content.tagline ?? "");
    drawBook(doc, item, userName, dateLabel, margin, contentWidth);
  }

  doc.save(`${slugify(item.name)}.pdf`);
}

export async function countEbookPages(item) {
  if (!item?.content || item.content.kind !== "book") {
    return 0;
  }
  const { jsPDF } = await import("jspdf");
  const margin = 40;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawHeader(doc, item.name, item.content.tagline ?? "");
  drawBook(doc, item, "EcoMind User", new Date(), margin, doc.internal.pageSize.getWidth() - margin * 2);
  return doc.internal.getNumberOfPages();
}

function drawBook(doc, item, userName, dateLabel, margin, contentWidth) {
  let y = 130;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`Prepared for ${userName}  •  ${dateLabel}`, margin, y);
  y += 26;

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Your at-a-glance eco playbook", margin, y);
  y += 34;

  (item.content.sections ?? []).forEach((section) => {
    y = pageBreak(doc, y, margin, 140);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...FOREST);
    doc.text(section.heading, margin, y);
    y += 34;

    (section.paragraphs ?? []).forEach((paragraph) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(paragraph, contentWidth);
      lines.forEach((line) => {
        y = pageBreak(doc, y, margin, 60);
        doc.text(line, margin, y);
        y += 22;
      });
      y += 16;
    });

    y += 16;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("EcoMind — measure, reduce, and celebrate every small step.", margin, doc.internal.pageSize.getHeight() - 40);
}

function drawCertificate(doc, item, userName, dateLabel) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = doc.internal.pageSize.getWidth();
  const box = { x: 50, y: 140, w: width - 100, h: pageHeight - 220 };

  doc.setDrawColor(...FOREST);
  doc.setLineWidth(2);
  doc.rect(box.x, box.y, box.w, box.h);
  doc.setDrawColor(...FOREST_DARK);
  doc.setLineWidth(0.75);
  doc.rect(box.x + 10, box.y + 10, box.w - 20, box.h - 20);

  const centerX = width / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...FOREST);
  doc.text("Certificate of Carbon Offset", centerX, box.y + 80, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text("This certifies that", centerX, box.y + 120, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(userName, centerX, box.y + 155, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  const kg = item.content.offsetKg ?? 100;
  doc.text(`has offset ${kg} kg CO2e`, centerX, box.y + 185, { align: "center" });

  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const noteLines = doc.splitTextToSize(item.content.note ?? "", box.w - 120);
  doc.text(noteLines, centerX, box.y + 225, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...FOREST);
  doc.text(dateLabel, box.x + 60, box.y + box.h - 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("EcoMind Climate Programme", box.x + 60, box.y + box.h - 54);
  doc.setDrawColor(...FOREST);
  doc.setLineWidth(0.75);
  doc.line(box.x + 60, box.y + box.h - 60, box.x + 160, box.y + box.h - 60);
}
