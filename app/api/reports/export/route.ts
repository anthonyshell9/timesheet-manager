import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logExportAction } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const formatType = searchParams.get('format');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');

    if (!formatType || !['csv', 'excel', 'pdf'].includes(formatType)) {
      return errorResponse('Format invalide', 400);
    }

    if (!startDate || !endDate) {
      return errorResponse('Dates requises', 400);
    }

    // Fetch time entries
    const where: {
      userId: string;
      date: { gte: Date; lte: Date };
      projectId?: string;
    } = {
      userId: session.user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (projectId && projectId !== 'all') {
      where.projectId = projectId;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            hourlyRate: true,
          },
        },
        subProject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate aggregates
    const projectMap: Record<
      string,
      {
        projectName: string;
        projectCode: string;
        hours: number;
        billableHours: number;
        value: number;
      }
    > = {};

    let totalHours = 0;
    let totalBillableHours = 0;

    entries.forEach((entry) => {
      const hours = entry.duration / 60;
      totalHours += hours;

      if (entry.isBillable) {
        totalBillableHours += hours;
      }

      let project = projectMap[entry.project.id];
      if (!project) {
        project = {
          projectName: entry.project.name,
          projectCode: entry.project.code,
          hours: 0,
          billableHours: 0,
          value: 0,
        };
        projectMap[entry.project.id] = project;
      }

      project.hours += hours;
      if (entry.isBillable) {
        project.billableHours += hours;
        const rate = entry.project.hourlyRate ? Number(entry.project.hourlyRate) : 150;
        project.value += hours * rate;
      }
    });

    const projectBreakdown = Object.values(projectMap).sort((a, b) => b.hours - a.hours);
    const totalValue = projectBreakdown.reduce((acc, p) => acc + p.value, 0);

    await logExportAction(formatType, {
      startDate,
      endDate,
      projectId,
      userId: session.user.id,
    });

    // Generate export based on format
    if (formatType === 'csv') {
      return generateCSV(entries, session.user.name || 'Utilisateur', startDate, endDate);
    } else if (formatType === 'excel') {
      return generateExcel(
        entries,
        projectBreakdown,
        { totalHours, totalBillableHours, totalValue },
        session.user.name || 'Utilisateur',
        startDate,
        endDate
      );
    } else if (formatType === 'pdf') {
      return generatePDF(
        entries,
        projectBreakdown,
        { totalHours, totalBillableHours, totalValue },
        session.user.name || 'Utilisateur',
        startDate,
        endDate
      );
    }

    return errorResponse('Format non supporté', 400);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

function generateCSV(
  entries: Array<{
    date: Date;
    duration: number;
    description: string | null;
    isBillable: boolean;
    project: { name: string; code: string };
    subProject: { name: string } | null;
  }>,
  userName: string,
  startDate: string,
  endDate: string
) {
  const headers = ['Date', 'Projet', 'Code', 'Sous-projet', 'Description', 'Durée (h)', 'Facturable'];
  const rows = entries.map((entry) => [
    format(new Date(entry.date), 'dd/MM/yyyy'),
    entry.project.name,
    entry.project.code,
    entry.subProject?.name || '',
    entry.description || '',
    (entry.duration / 60).toFixed(2),
    entry.isBillable ? 'Oui' : 'Non',
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

  const filename = `rapport_${userName.replace(/\s+/g, '_')}_${format(new Date(startDate), 'yyyyMMdd')}_${format(new Date(endDate), 'yyyyMMdd')}.csv`;

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

async function generateExcel(
  entries: Array<{
    date: Date;
    duration: number;
    description: string | null;
    isBillable: boolean;
    startTime: string | null;
    endTime: string | null;
    project: { name: string; code: string; hourlyRate: unknown };
    subProject: { name: string } | null;
  }>,
  projectBreakdown: Array<{
    projectName: string;
    projectCode: string;
    hours: number;
    billableHours: number;
    value: number;
  }>,
  totals: { totalHours: number; totalBillableHours: number; totalValue: number },
  userName: string,
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TimeSheet Manager';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Résumé');
  summarySheet.columns = [
    { header: 'Projet', key: 'project', width: 30 },
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Heures', key: 'hours', width: 12 },
    { header: 'Heures Facturables', key: 'billableHours', width: 18 },
    { header: 'Valeur (€)', key: 'value', width: 15 },
  ];

  // Style header
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  projectBreakdown.forEach((project) => {
    summarySheet.addRow({
      project: project.projectName,
      code: project.projectCode,
      hours: Number(project.hours.toFixed(2)),
      billableHours: Number(project.billableHours.toFixed(2)),
      value: Number(project.value.toFixed(2)),
    });
  });

  // Add totals row
  const totalRow = summarySheet.addRow({
    project: 'TOTAL',
    code: '',
    hours: Number(totals.totalHours.toFixed(2)),
    billableHours: Number(totals.totalBillableHours.toFixed(2)),
    value: Number(totals.totalValue.toFixed(2)),
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  // Details sheet
  const detailsSheet = workbook.addWorksheet('Détails');
  detailsSheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Projet', key: 'project', width: 25 },
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Sous-projet', key: 'subProject', width: 20 },
    { header: 'Début', key: 'startTime', width: 10 },
    { header: 'Fin', key: 'endTime', width: 10 },
    { header: 'Durée (h)', key: 'duration', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Facturable', key: 'billable', width: 12 },
  ];

  // Style header
  detailsSheet.getRow(1).font = { bold: true };
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  entries.forEach((entry) => {
    detailsSheet.addRow({
      date: format(new Date(entry.date), 'dd/MM/yyyy'),
      project: entry.project.name,
      code: entry.project.code,
      subProject: entry.subProject?.name || '',
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      duration: Number((entry.duration / 60).toFixed(2)),
      description: entry.description || '',
      billable: entry.isBillable ? 'Oui' : 'Non',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `rapport_${userName.replace(/\s+/g, '_')}_${format(new Date(startDate), 'yyyyMMdd')}_${format(new Date(endDate), 'yyyyMMdd')}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function generatePDF(
  entries: Array<{
    date: Date;
    duration: number;
    description: string | null;
    isBillable: boolean;
    project: { name: string; code: string };
    subProject: { name: string } | null;
  }>,
  projectBreakdown: Array<{
    projectName: string;
    projectCode: string;
    hours: number;
    billableHours: number;
    value: number;
  }>,
  totals: { totalHours: number; totalBillableHours: number; totalValue: number },
  userName: string,
  startDate: string,
  endDate: string
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('Rapport de Temps', 14, 22);

  // User and period info
  doc.setFontSize(11);
  doc.text(`Collaborateur: ${userName}`, 14, 32);
  doc.text(
    `Période: ${format(new Date(startDate), 'd MMMM yyyy', { locale: fr })} - ${format(new Date(endDate), 'd MMMM yyyy', { locale: fr })}`,
    14,
    39
  );

  // Summary table
  doc.setFontSize(14);
  doc.text('Résumé par Projet', 14, 52);

  autoTable(doc, {
    startY: 57,
    head: [['Projet', 'Code', 'Heures', 'Facturables', 'Valeur (€)']],
    body: [
      ...projectBreakdown.map((p) => [
        p.projectName,
        p.projectCode,
        p.hours.toFixed(1),
        p.billableHours.toFixed(1),
        p.value.toFixed(2),
      ]),
      ['TOTAL', '', totals.totalHours.toFixed(1), totals.totalBillableHours.toFixed(1), totals.totalValue.toFixed(2)],
    ],
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    didParseCell: (data) => {
      // Style total row
      if (data.row.index === projectBreakdown.length && data.section === 'body') {
        data.cell.styles.fillColor = [229, 231, 235];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Details table on new page if needed
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  if (entries.length > 0) {
    if (finalY > 200) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Détail des Entrées', 14, 22);

      autoTable(doc, {
        startY: 27,
        head: [['Date', 'Projet', 'Durée (h)', 'Description']],
        body: entries.map((e) => [
          format(new Date(e.date), 'dd/MM/yyyy'),
          e.project.name,
          (e.duration / 60).toFixed(1),
          (e.description || '').substring(0, 50) + ((e.description?.length || 0) > 50 ? '...' : ''),
        ]),
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 20 },
          3: { cellWidth: 'auto' },
        },
      });
    } else {
      doc.setFontSize(14);
      doc.text('Détail des Entrées', 14, finalY + 15);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Date', 'Projet', 'Durée (h)', 'Description']],
        body: entries.map((e) => [
          format(new Date(e.date), 'dd/MM/yyyy'),
          e.project.name,
          (e.duration / 60).toFixed(1),
          (e.description || '').substring(0, 50) + ((e.description?.length || 0) > 50 ? '...' : ''),
        ]),
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 20 },
          3: { cellWidth: 'auto' },
        },
      });
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128);
    doc.text(`Généré le ${format(new Date(), 'd MMMM yyyy à HH:mm', { locale: fr })}`, 14, 287);
    doc.text(`Page ${i} / ${pageCount}`, 180, 287);
  }

  const pdfBuffer = doc.output('arraybuffer');
  const filename = `rapport_${userName.replace(/\s+/g, '_')}_${format(new Date(startDate), 'yyyyMMdd')}_${format(new Date(endDate), 'yyyyMMdd')}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
