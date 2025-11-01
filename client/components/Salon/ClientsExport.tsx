import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClients } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { FileText, FileSpreadsheet } from "lucide-react";

const lastVisitFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function formatLastVisit(timestamp: number | null | undefined) {
  if (timestamp == null) return "—";
  return lastVisitFormatter.format(new Date(timestamp));
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

type ExportClient = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  lastVisit: string;
  lastVisitAt: number | null;
};

const columns = [
  { key: "firstName" as const, label: "Prénom", width: 100 },
  { key: "lastName" as const, label: "Nom", width: 130 },
  { key: "email" as const, label: "Email", width: 180 },
  { key: "phone" as const, label: "Téléphone", width: 90 },
  { key: "lastVisit" as const, label: "Dernier passage", width: 150 },
];

function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? name.trim(), lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function createCsv(clients: ExportClient[]): string {
  const sep = ";";
  const header = ["prenom", "nom", "email", "tel", "dernier_passage"].join(sep);
  const escapeValue = (value: string) => {
    const sanitized = value.replace(/"/g, '""');
    return /["\n;]/.test(value) ? `"${sanitized}"` : sanitized;
  };
  const rows = clients.map(({ firstName, lastName, email, phone, lastVisit }) =>
    [firstName, lastName, email, phone, lastVisit].map((v) => escapeValue(v)).join(sep),
  );
  return [header, ...rows].join("\n");
}

async function createPdf(clients: ExportClient[]): Promise<Blob> {
  const doc = await PDFDocument.create();
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  const headerSize = 18;
  const subtitleSize = 10;
  const textSize = 11;
  const rowHeight = 20;
  const generatedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const columnOffsets = columns.map((_, index) =>
    columns.slice(0, index).reduce((total, column) => total + column.width, 0),
  );

  const fitText = (text: string, maxWidth: number) => {
    if (text === "") return "";
    if (regularFont.widthOfTextAtSize(text, textSize) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && regularFont.widthOfTextAtSize(`${truncated}…`, textSize) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated.length === text.length ? truncated : `${truncated}…`;
  };

  let page = doc.addPage();
  let { height } = page.getSize();
  let y = 0;

  const drawPageHeader = (subtitle: string) => {
    ({ height } = page.getSize());
    y = height - margin;
    page.drawText("Clients — Export marketing", {
      x: margin,
      y,
      size: headerSize,
      font: boldFont,
    });
    y -= headerSize + 8;
    page.drawText(subtitle, {
      x: margin,
      y,
      size: subtitleSize,
      font: regularFont,
    });
    y -= rowHeight;
    columns.forEach((column, index) => {
      page.drawText(column.label, {
        x: margin + columnOffsets[index],
        y,
        size: textSize,
        font: boldFont,
      });
    });
    y -= rowHeight;
  };

  drawPageHeader(`Généré le ${generatedAt}`);

  clients.forEach((client, index) => {
    if (y < margin + rowHeight) {
      page = doc.addPage();
      drawPageHeader(`Suite (${generatedAt})`);
    }
    const row = {
      firstName: client.firstName || "-",
      lastName: client.lastName || "-",
      email: client.email || "-",
      phone: client.phone || "-",
      lastVisit: client.lastVisit || "-",
    };
    columns.forEach((column, columnIndex) => {
      const value = row[column.key];
      const text = fitText(value, column.width - 8);
      page.drawText(text, {
        x: margin + columnOffsets[columnIndex],
        y,
        size: textSize,
        font: regularFont,
      });
    });
    y -= rowHeight;
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function ClientsExport() {
  const { data: clients, isLoading } = useClients(true);
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(() => formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [busy, setBusy] = useState<"csv" | "pdf" | "">("");

  const exportableClients = useMemo<ExportClient[]>(() => {
    return (clients ?? []).map((client) => {
      const { firstName, lastName } = splitName(client.name);
      const lastVisitLabel = formatLastVisit(client.lastVisitAt);
      return {
        firstName,
        lastName,
        email: client.email ?? "",
        phone: client.phone ?? "",
        lastVisit: lastVisitLabel,
        lastVisitAt: client.lastVisitAt ?? null,
      };
    });
  }, [clients]);

  const startTimestamp = useMemo(() => parseDateInput(startDate, false), [startDate]);
  const endTimestamp = useMemo(() => parseDateInput(endDate, true), [endDate]);
  const hasFilter = Boolean(startTimestamp != null || endTimestamp != null);
  const invalidRange =
    startTimestamp != null && endTimestamp != null && startTimestamp > endTimestamp;

  const filteredClients = useMemo<ExportClient[]>(() => {
    if (invalidRange) {
      return [];
    }
    if (!hasFilter) {
      return exportableClients;
    }
    return exportableClients.filter((client) => {
      if (client.lastVisitAt == null) {
        return false;
      }
      if (startTimestamp != null && client.lastVisitAt < startTimestamp) {
        return false;
      }
      if (endTimestamp != null && client.lastVisitAt > endTimestamp) {
        return false;
      }
      return true;
    });
  }, [exportableClients, endTimestamp, hasFilter, invalidRange, startTimestamp]);

  const hasClients = filteredClients.length > 0;

  const latestVisit = useMemo(() => {
    return filteredClients.reduce<{ label: string; at: number } | null>((acc, client) => {
      if (!client.lastVisitAt) return acc;
      if (!acc || client.lastVisitAt > acc.at) {
        return { label: client.lastVisit, at: client.lastVisitAt };
      }
      return acc;
    }, null);
  }, [filteredClients]);

  const resetDateFilters = () => {
    const today = formatDateInput(new Date());
    setStartDate(today);
    setEndDate(today);
  };

  const handleCsv = async () => {
    if (invalidRange) {
      toast({
        title: "Intervalle de dates invalide",
        description: "Corrigez les dates avant d'exporter.",
        variant: "destructive",
      });
      return;
    }
    if (!hasClients) {
      toast({
        title: hasFilter ? "Aucun client sur cette période" : "Aucun client disponible",
        description: hasFilter
          ? "Ajustez les dates ou réinitialisez le filtre."
          : "Ajoutez des clients avant d'exporter.",
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy("csv");
      const csv = createCsv(filteredClients);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, "clients-campagne.csv");
      toast({
        title: "Export CSV prêt",
        description: "Le fichier a été téléchargé.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur lors de l'export",
        description: "Impossible de générer le CSV.",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  const handlePdf = async () => {
    if (invalidRange) {
      toast({
        title: "Intervalle de dates invalide",
        description: "Corrigez les dates avant d'exporter.",
        variant: "destructive",
      });
      return;
    }
    if (!hasClients) {
      toast({
        title: hasFilter ? "Aucun client sur cette période" : "Aucun client disponible",
        description: hasFilter
          ? "Ajustez les dates ou réinitialisez le filtre."
          : "Ajoutez des clients avant d'exporter.",
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy("pdf");
      const blob = await createPdf(filteredClients);
      downloadBlob(blob, "clients-campagne.pdf");
      toast({
        title: "Export PDF prêt",
        description: "Le fichier a été téléchargé.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur lors de l'export",
        description: "Impossible de générer le PDF.",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card className="border border-border/40 bg-background/30 px-2.5 py-1.5 shadow-none">
      <CardHeader className="flex items-center justify-between space-y-0 p-0">
        <CardTitle className="text-[13px] font-medium text-muted-foreground">Exports fichier clients</CardTitle>
        <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70">Clients</span>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pt-1">
        {hasClients ? (
          <div className="text-[10px] text-muted-foreground/70">
            {latestVisit ? `Dernier passage enregistré : ${latestVisit.label}.` : "Aucun passage enregistré pour l’instant."}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-1 pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] uppercase tracking-[0.08em] text-muted-foreground/60">Du</span>
            <Input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-6 w-[118px] rounded-sm border-border/40 bg-background/40 px-1 text-[10px] text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] uppercase tracking-[0.08em] text-muted-foreground/60">Au</span>
            <Input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-6 w-[118px] rounded-sm border-border/40 bg-background/40 px-1 text-[10px] text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          {(startDate || endDate) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={resetDateFilters}
            >
              Réinitialiser
            </Button>
          ) : null}
        </div>
        {invalidRange ? (
          <p className="text-[9px] text-destructive">La date de début doit être antérieure à la date de fin.</p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!hasClients || busy === "pdf" || isLoading || invalidRange}
            onClick={handleCsv}
          >
            <FileSpreadsheet className="h-2.5 w-2.5" />
            CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!hasClients || busy === "csv" || isLoading || invalidRange}
            onClick={handlePdf}
          >
            <FileText className="h-2.5 w-2.5" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
