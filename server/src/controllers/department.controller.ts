import { Request, Response } from 'express';
import { DepartmentService } from '../services/department.service';

export async function getDepartments(req: Request, res: Response) {
  const departments = await DepartmentService.getDepartments();
  return res.json({ success: true, data: departments });
}

export async function getDepartmentById(req: Request, res: Response) {
  const department = await DepartmentService.getDepartmentById(req.params.id as string);
  return res.json({ success: true, data: department });
}
