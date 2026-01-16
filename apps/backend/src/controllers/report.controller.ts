import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import reportService from '../services/report.service';
import CsvGenerator from '../utils/csv-generator';
import PdfGenerator from '../utils/pdf-generator';
import prisma from '../utils/prisma';

class ReportController {
  /**
   * GET /api/reports/teacher-payouts
   * Get teacher payouts report
   */
  async getTeacherPayoutsReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { startDate, endDate, teacherId } = req.query;

      const filters = {
        organizationId,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        teacherId: teacherId ? String(teacherId) : undefined,
      };

      const data = await reportService.generateTeacherPayoutsReport(filters);

      return res.json({
        message: 'Teacher payouts report generated successfully',
        data,
      });
    } catch (error) {
      console.error('Error generating teacher payouts report:', error);
      return res.status(500).json({ message: 'Failed to generate teacher payouts report' });
    }
  }

  /**
   * GET /api/reports/new-students
   * Get new students report for a specific month
   */
  async getNewStudentsReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { month, year } = req.query;

      if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required' });
      }

      const data = await reportService.generateNewStudentsReport(
        organizationId,
        parseInt(String(month)),
        parseInt(String(year))
      );

      return res.json({
        message: 'New students report generated successfully',
        data,
      });
    } catch (error) {
      console.error('Error generating new students report:', error);
      return res.status(500).json({ message: 'Failed to generate new students report' });
    }
  }

  /**
   * GET /api/reports/margins
   * Get margins report
   */
  async getMarginsReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { startDate, endDate, courseTypeId } = req.query;

      const filters = {
        organizationId,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        courseTypeId: courseTypeId ? String(courseTypeId) : undefined,
      };

      const data = await reportService.generateMarginsReport(filters);

      return res.json({
        message: 'Margins report generated successfully',
        data,
      });
    } catch (error) {
      console.error('Error generating margins report:', error);
      return res.status(500).json({ message: 'Failed to generate margins report' });
    }
  }

  /**
   * GET /api/reports/debtors
   * Get debtors report
   */
  async getDebtorsReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { minAmount, daysPastDue } = req.query;

      const data = await reportService.generateDebtorsReport(
        organizationId,
        minAmount ? parseFloat(String(minAmount)) : undefined,
        daysPastDue ? parseInt(String(daysPastDue)) : undefined
      );

      return res.json({
        message: 'Debtors report generated successfully',
        data,
      });
    } catch (error) {
      console.error('Error generating debtors report:', error);
      return res.status(500).json({ message: 'Failed to generate debtors report' });
    }
  }

  /**
   * GET /api/reports/retention
   * Get retention and churn report
   */
  async getRetentionReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { periodDays } = req.query;

      const data = await reportService.generateRetentionReport(
        organizationId,
        periodDays ? parseInt(String(periodDays)) : 30
      );

      return res.json({
        message: 'Retention report generated successfully',
        data,
      });
    } catch (error) {
      console.error('Error generating retention report:', error);
      return res.status(500).json({ message: 'Failed to generate retention report' });
    }
  }

  /**
   * GET /api/reports/export/:reportType
   * Export report as CSV or PDF
   */
  async exportReport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { reportType } = req.params;
      const { format, ...filters } = req.query;

      if (!format || (format !== 'csv' && format !== 'pdf')) {
        return res.status(400).json({ message: 'Format must be csv or pdf' });
      }

      // Get organization name for PDF header
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });

      const orgName = organization?.name || 'LingoDesk';

      let data: any;
      let fileName: string;
      let content: Buffer | string;

      switch (reportType) {
        case 'teacher-payouts':
          data = await reportService.generateTeacherPayoutsReport({
            organizationId,
            startDate: filters.startDate ? new Date(String(filters.startDate)) : undefined,
            endDate: filters.endDate ? new Date(String(filters.endDate)) : undefined,
            teacherId: filters.teacherId ? String(filters.teacherId) : undefined,
          });

          if (format === 'csv') {
            content = CsvGenerator.generateTeacherPayoutsCsv(data);
            fileName = `wyplaty-nauczycieli-${new Date().toISOString().split('T')[0]}.csv`;
          } else {
            content = await PdfGenerator.generateTeacherPayoutsPdf(
              data,
              orgName,
              filters.startDate && filters.endDate
                ? { start: new Date(String(filters.startDate)), end: new Date(String(filters.endDate)) }
                : undefined
            );
            fileName = `wyplaty-nauczycieli-${new Date().toISOString().split('T')[0]}.pdf`;
          }
          break;

        case 'new-students':
          if (!filters.month || !filters.year) {
            return res.status(400).json({ message: 'Month and year are required' });
          }

          data = await reportService.generateNewStudentsReport(
            organizationId,
            parseInt(String(filters.month)),
            parseInt(String(filters.year))
          );

          if (format === 'csv') {
            content = CsvGenerator.generateNewStudentsCsv(data);
            fileName = `nowi-uczniowie-${filters.month}-${filters.year}.csv`;
          } else {
            content = await PdfGenerator.generateNewStudentsPdf(
              data,
              orgName,
              parseInt(String(filters.month)),
              parseInt(String(filters.year))
            );
            fileName = `nowi-uczniowie-${filters.month}-${filters.year}.pdf`;
          }
          break;

        case 'margins':
          data = await reportService.generateMarginsReport({
            organizationId,
            startDate: filters.startDate ? new Date(String(filters.startDate)) : undefined,
            endDate: filters.endDate ? new Date(String(filters.endDate)) : undefined,
            courseTypeId: filters.courseTypeId ? String(filters.courseTypeId) : undefined,
          });

          if (format === 'csv') {
            content = CsvGenerator.generateMarginsCsv(data);
            fileName = `marze-${new Date().toISOString().split('T')[0]}.csv`;
          } else {
            content = await PdfGenerator.generateMarginsPdf(
              data,
              orgName,
              filters.startDate && filters.endDate
                ? { start: new Date(String(filters.startDate)), end: new Date(String(filters.endDate)) }
                : undefined
            );
            fileName = `marze-${new Date().toISOString().split('T')[0]}.pdf`;
          }
          break;

        case 'debtors':
          data = await reportService.generateDebtorsReport(
            organizationId,
            filters.minAmount ? parseFloat(String(filters.minAmount)) : undefined,
            filters.daysPastDue ? parseInt(String(filters.daysPastDue)) : undefined
          );

          if (format === 'csv') {
            content = CsvGenerator.generateDebtorsCsv(data);
            fileName = `dluznicy-${new Date().toISOString().split('T')[0]}.csv`;
          } else {
            content = await PdfGenerator.generateDebtorsPdf(data, orgName);
            fileName = `dluznicy-${new Date().toISOString().split('T')[0]}.pdf`;
          }
          break;

        case 'retention':
          const periodDays = filters.periodDays ? parseInt(String(filters.periodDays)) : 30;
          data = await reportService.generateRetentionReport(organizationId, periodDays);

          if (format === 'csv') {
            content = CsvGenerator.generateRetentionCsv(data);
            fileName = `retencja-${new Date().toISOString().split('T')[0]}.csv`;
          } else {
            content = await PdfGenerator.generateRetentionPdf(data, orgName, periodDays);
            fileName = `retencja-${new Date().toISOString().split('T')[0]}.pdf`;
          }
          break;

        default:
          return res.status(400).json({ message: 'Invalid report type' });
      }

      // Set response headers for file download
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.send(content);
    } catch (error) {
      console.error('Error exporting report:', error);
      return res.status(500).json({ message: 'Failed to export report' });
    }
  }
}

export default new ReportController();
