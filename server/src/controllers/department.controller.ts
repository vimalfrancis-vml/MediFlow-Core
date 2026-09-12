import { Request, Response, NextFunction } from 'express';
import { DepartmentService } from '../services/department.service';

export async function getDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = {
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const departments = await DepartmentService.getDepartments(filter);
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

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const department = await DepartmentService.createDepartment(req.body);
    return res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (err) {
    next(err);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const department = await DepartmentService.updateDepartment(req.params.id as string, req.body);
    return res.json({ success: true, message: 'Department updated successfully', data: department });
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

export async function setDepartmentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body;
    const department = await DepartmentService.setDepartmentStatus(req.params.id as string, Boolean(isActive));
    return res.json({ success: true, message: `Department ${isActive ? 'activated' : 'deactivated'} successfully`, data: department });
  } catch (err) {
    next(err);
  }
}
