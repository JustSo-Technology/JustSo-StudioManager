import { and, eq } from "drizzle-orm";
import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../db";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByAuthentikIdentity(issuer: string, subject: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return user;
  }

  async getUserByAuthentikIdentity(issuer: string, subject: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.authentikIssuer, issuer), eq(users.authentikSubject, subject)));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.id) {
      return this.updateUser(userData.id, userData);
    }

    const existingByIdentity =
      userData.authentikIssuer && userData.authentikSubject
        ? await this.getUserByAuthentikIdentity(userData.authentikIssuer, userData.authentikSubject)
        : undefined;
    if (existingByIdentity) {
      return this.updateUser(existingByIdentity.id, userData);
    }

    const existingByEmail = userData.email ? await this.getUserByEmail(userData.email) : undefined;
    if (existingByEmail) {
      return this.updateUser(existingByEmail.id, userData);
    }

    return this.createUser(userData);
  }
}

export const authStorage = new AuthStorage();
