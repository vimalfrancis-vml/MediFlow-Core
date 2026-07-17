import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

export async function getUsers(req: Request, res: Response) {
  const users = await UserService.getUsers();
  return res.json({ success: true, data: users });
}

export async function getUserById(req: Request, res: Response) {
  const user = await UserService.getUserById(req.params.id as string);
  return res.json({ success: true, data: user });
}
