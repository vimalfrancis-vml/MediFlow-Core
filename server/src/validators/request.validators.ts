// src/validators/request.validators.ts
import { z } from 'zod';

export const baseRequestSchema = z.object({
  title: z.string().min(1, { message: 'Title is required.' }),
  type: z.preprocess(
    (val) => (val === 'GENERAL_REQUEST' ? 'GENERAL' : val),
    z.enum(['PURCHASE', 'LEAVE', 'MAINTENANCE', 'GENERAL'])
  ),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  workflowTemplateId: z.string().optional(),
  details: z
    .object({
      // Purchase fields
      itemDescription: z.string().optional(),
      quantity: z
        .number({ message: 'Quantity must be a number.' })
        .int({ message: 'Quantity must be an integer.' })
        .min(1, { message: 'Quantity must be at least 1.' })
        .optional(),
      justification: z.string().optional(),
      vendorName: z.string().optional(),
      budgetCode: z.string().optional(),
      estimatedCost: z
        .number({ message: 'Estimated cost must be a number.' })
        .positive({ message: 'Estimated cost must be greater than zero.' })
        .optional(),

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

      // General fields
      subject: z.string().optional(),
      description: z.string().optional(),
      targetDepartmentId: z.string().optional(),
      targetUserId: z.string().optional(),
      requiredDate: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const createRequestSchema = baseRequestSchema.superRefine((data, ctx) => {
  if (data.type === 'PURCHASE') {
    if (!data.details || typeof data.details !== 'object') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details'],
        message: 'Details are required for Purchase requests.',
      });
      return;
    }

    const { itemDescription, estimatedCost, quantity } = data.details as any;

    if (typeof itemDescription !== 'string' || !itemDescription.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'itemDescription'],
        message: 'Item description is required.',
      });
    }

    if (estimatedCost === undefined || estimatedCost === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'estimatedCost'],
        message: 'Estimated cost is required.',
      });
    } else if (
      typeof estimatedCost !== 'number' ||
      isNaN(estimatedCost) ||
      !isFinite(estimatedCost) ||
      estimatedCost <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'estimatedCost'],
        message: 'Estimated cost must be greater than zero.',
      });
    }

    if (
      quantity !== undefined &&
      (typeof quantity !== 'number' || quantity < 1 || !Number.isInteger(quantity))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'quantity'],
        message: 'Quantity must be at least 1.',
      });
    }
  }
});

export const editRequestSchema = baseRequestSchema
  .partial()
  .extend({
    id: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.details) {
      const { itemDescription, estimatedCost, quantity } = data.details as any;
      if (itemDescription !== undefined && (typeof itemDescription !== 'string' || !itemDescription.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['details', 'itemDescription'],
          message: 'Item description cannot be empty.',
        });
      }
      if (estimatedCost !== undefined) {
        if (
          typeof estimatedCost !== 'number' ||
          isNaN(estimatedCost) ||
          !isFinite(estimatedCost) ||
          estimatedCost <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['details', 'estimatedCost'],
            message: 'Estimated cost must be greater than zero.',
          });
        }
      }
      if (
        quantity !== undefined &&
        (typeof quantity !== 'number' || quantity < 1 || !Number.isInteger(quantity))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['details', 'quantity'],
          message: 'Quantity must be at least 1.',
        });
      }
    }
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


