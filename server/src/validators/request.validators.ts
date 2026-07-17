// src/validators/request.validators.ts
import { z } from 'zod';

export const createRequestSchema = z.object({
  title: z.string().min(1, { message: 'Title is required.' }),
  type: z.enum(['PURCHASE', 'LEAVE', 'MAINTENANCE']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  details: z.object({
    itemDescription: z.string().optional(),
    quantity: z.number().optional(),
    justification: z.string().optional(),
    vendorName: z.string().optional(),
    budgetCode: z.string().optional(),
    estimatedCost: z.number().optional(),
    leaveType: z.string().optional(),
    urgencyLevel: z.string().optional(),
    totalDays: z.number().optional(),
  }).optional(),
});

export const editRequestSchema = createRequestSchema.partial().extend({
  id: z.string(),
});

export const commentSchema = z.object({
  comment: z.string().min(1, { message: 'Comment cannot be empty.' }),
});

export const documentSchema = z.object({
  fileName: z.string().min(1, { message: 'File name is required.' }),
  url: z.string().url({ message: 'A valid URL is required.' }),
});
