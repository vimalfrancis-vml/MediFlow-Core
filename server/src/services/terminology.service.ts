import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export class TerminologyService {
  static async getTerminologies(category?: string) {
    const where: any = {};
    if (category) where.category = category.toUpperCase();

    const terms = await prisma.systemTerminology.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });

    return terms;
  }

  static async getTerminologyByKey(key: string) {
    const term = await prisma.systemTerminology.findUnique({
      where: { key },
    });

    if (!term) {
      throw new AppError(`Terminology with key '${key}' not found`, 404);
    }

    return term;
  }

  static async updateTerminology(key: string, data: { label: string; description?: string }) {
    if (!data.label || !data.label.trim()) {
      throw new AppError('Display label is required', 400);
    }

    const existing = await prisma.systemTerminology.findUnique({ where: { key } });
    if (!existing) {
      throw new AppError(`Terminology with key '${key}' not found`, 404);
    }

    const updated = await prisma.systemTerminology.update({
      where: { key },
      data: {
        label: data.label.trim(),
        description: data.description !== undefined ? (data.description ? data.description.trim() : null) : existing.description,
      },
    });

    return updated;
  }
}
