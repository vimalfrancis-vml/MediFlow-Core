import { Request, Response, NextFunction } from 'express';
import { DepartmentManagementService } from '../services/department-management.service';
import { AppError } from '../middleware/errorHandler';

function getActor(req: Request) {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }
  return req.user as any;
}

export async function getDepartmentEmployees(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const departmentId = req.query.departmentId as string | undefined;
    const query = {
      search: req.query.search as string | undefined,
      positionId: req.query.positionId as string | undefined,
      status: req.query.status as string | undefined,
    };
    const result = await DepartmentManagementService.getDepartmentEmployees(actor, departmentId, query);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createDepartmentEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const result = await DepartmentManagementService.createDepartmentEmployee(actor, req.body);
    return res.status(201).json({
      success: true,
      message: 'Employee created successfully with temporary credentials.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDepartmentEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const employeeId = req.params.id as string;
    const result = await DepartmentManagementService.updateDepartmentEmployee(actor, employeeId, req.body);
    return res.json({
      success: true,
      message: 'Employee details updated successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function checkDeactivationImpact(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const employeeId = req.params.id as string;
    const result = await DepartmentManagementService.checkEmployeeDeactivationImpact(actor, employeeId);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function deactivateDepartmentEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const employeeId = req.params.id as string;
    const result = await DepartmentManagementService.deactivateDepartmentEmployee(actor, employeeId, req.body);
    return res.json({
      success: true,
      message: 'Employee deactivated successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function assignEmployeePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const employeeId = req.params.id as string;
    const result = await DepartmentManagementService.assignEmployeePosition(actor, employeeId, req.body);
    return res.json({
      success: true,
      message: 'Hospital position assigned successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeePositionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const employeeId = req.params.id as string;
    const result = await DepartmentManagementService.getEmployeePositionHistory(actor, employeeId);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const departmentId = req.query.departmentId as string | undefined;
    const query = {
      search: req.query.search as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const result = await DepartmentManagementService.getDepartmentPositions(actor, departmentId, query);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const result = await DepartmentManagementService.createPosition(actor, req.body);
    return res.status(201).json({
      success: true,
      message: 'Hospital position created successfully.',
      data: result.position,
      warning: result.warning,
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const positionId = req.params.id as string;
    const result = await DepartmentManagementService.updatePosition(actor, positionId, req.body);
    return res.json({
      success: true,
      message: 'Hospital position updated successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deactivatePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = getActor(req);
    const positionId = req.params.id as string;
    const result = await DepartmentManagementService.deactivatePosition(actor, positionId, req.body);
    return res.json({
      success: true,
      message: 'Hospital position deactivated successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminDepartmentOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await DepartmentManagementService.getAdminDepartmentOverview();
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getAllPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const query = {
      search: req.query.search as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const result = await DepartmentManagementService.getAllPositions(query);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

