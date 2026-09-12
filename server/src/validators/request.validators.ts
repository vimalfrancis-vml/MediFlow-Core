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
  fileName: z
    .string()
    .min(1, { message: 'File name is required.' })
    .max(255, { message: 'File name cannot exceed 255 characters.' })
    .refine((name) => !/[\\/\0]|(\.\.)/.test(name), {
      message: 'File name must not contain directory traversal characters or path separators.',
    })
    .refine((name) => !/\.(exe|bat|cmd|sh|php|pl|cgi|vbs|jar|msi|ps1)$/i.test(name), {
      message: 'Executable file types are not permitted.',
    }),
  url: z
    .string()
    .min(1, { message: 'Document URL or storage path is required.' })
    .refine((u) => !/^(javascript|data|vbscript|file):/i.test(u.trim()), {
      message: 'Dangerous URL scheme is strictly prohibited.',
    })
    .refine((u) => /^https?:\/\//i.test(u) || /^\/[a-zA-Z0-9_\-./]+$/.test(u), {
      message: 'Document location must be a valid HTTP/HTTPS URL or secure storage path.',
    }),
});


