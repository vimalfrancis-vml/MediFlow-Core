import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = {
      departmentId: req.query.departmentId as string | undefined,
      role: req.query.role as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const users = await UserService.getUsers(filter);
    return res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserService.getUserById(req.params.id as string);
    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserService.createUser(req.body);
    return res.status(201).json({ success: true, message: 'User created successfully', data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserService.updateUser(req.params.id as string, req.body);
    return res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (err) {
    next(err);
  }
}

export async function setUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body;
    const user = await UserService.setUserStatus(req.params.id as string, Boolean(isActive));
    return res.json({ success: true, message: `User ${isActive ? 'activated' : 'deactivated'} successfully`, data: user });
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    const user = await UserService.assignRole(req.params.id as string, role);
    return res.json({ success: true, message: 'User role updated successfully', data: user });
  } catch (err) {
    next(err);
  }
}

export async function assignDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const { departmentId } = req.body;
    const user = await UserService.assignDepartment(req.params.id as string, departmentId);
    return res.json({ success: true, message: 'User department updated successfully', data: user });
  } catch (err) {
    next(err);
  }
}
