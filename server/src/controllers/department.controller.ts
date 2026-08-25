import { Request, Response, NextFunction } from 'express';
import { DepartmentService } from '../services/department.service';

export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await DepartmentService.getDepartments();
    return res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const department = await DepartmentService.getDepartmentById(req.params.id as string);
    return res.json({ success: true, data: department });
  } catch (err) {
    next(err);
  }
}

export async function updateDepartmentHod(req: Request, res: Response, next: NextFunction) {
  try {
    const { hodId } = req.body;
    const department = await DepartmentService.updateDepartmentHod(req.params.id as string, hodId);
    return res.json({ success: true, message: 'Department HOD updated successfully', data: department });
  } catch (err) {
    next(err);
  }
}
