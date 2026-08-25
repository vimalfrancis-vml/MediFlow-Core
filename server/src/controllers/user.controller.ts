import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await UserService.getUsers();
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
