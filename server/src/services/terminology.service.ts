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

  static async updateTerminology(
    key: string,
    data: { label: string; description?: string },
    actor?: { id: string }
  ) {
    if (!data.label || !data.label.trim()) {
      throw new AppError('Display label is required', 400);
    }

    const existing = await prisma.systemTerminology.findUnique({ where: { key } });
    if (!existing) {
      throw new AppError(`Terminology with key '${key}' not found`, 404);
    }

    const changes: string[] = [];
    const newLabel = data.label.trim();
    if (newLabel !== existing.label) {
      changes.push(`Label changed from "${existing.label}" to "${newLabel}"`);
    }

    let newDesc = existing.description;
    if (data.description !== undefined) {
      newDesc = data.description ? data.description.trim() : null;
      if (newDesc !== existing.description) {
        changes.push('Description updated');
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.systemTerminology.update({
        where: { key },
        data: {
          label: newLabel,
          description: newDesc,
        },
      });

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            actorId: actor?.id,
            action: 'TERMINOLOGY_UPDATED',
            description: `System terminology "${key}" updated: ${changes.join(', ')}.`,
          },
        });
      }

      return updated;
    });
  }
}
