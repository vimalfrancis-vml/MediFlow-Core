// src/validators/request.validators.ts
import { z } from 'zod';

export const createRequestSchema = z.object({
  title: z.string().min(1, { message: 'Title is required.' }),
  type: z.enum(['PURCHASE', 'LEAVE', 'MAINTENANCE']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  details: z.object({
    // Purchase fields
    itemDescription: z.string().optional(),
    quantity: z.number().min(1, { message: 'Quantity must be at least 1.' }).optional(),
    justification: z.string().optional(),
    vendorName: z.string().optional(),
    budgetCode: z.string().optional(),
    estimatedCost: z.number().min(1, { message: 'Estimated cost must be greater than zero.' }).optional(),
    
    // Maintenance fields
    equipmentName: z.string().optional(),
    location: z.string().optional(),
    issueDescription: z.string().optional(),
    urgencyLevel: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
    notes: z.string().optional(),
    
    // Leave fields
    leaveType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    totalDays: z.number().optional(),
    reason: z.string().optional(),
    coveringStaff: z.string().optional(),
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

