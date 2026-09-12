import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';

export async function getRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = {
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const roles = await RoleService.getRoles(filter);
    return res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await RoleService.getRoleById(req.params.id as string);
    return res.json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await RoleService.updateRole(req.params.id as string, req.body);
    return res.json({ success: true, message: 'Role updated successfully', data: role });
  } catch (err) {
    next(err);
  }
}
