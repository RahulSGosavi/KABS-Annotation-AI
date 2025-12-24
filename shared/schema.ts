import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  pdfUrl: text("pdf_url").notNull(),
  pdfPageCount: text("pdf_page_count").notNull().default("1"),
  currentPage: text("current_page").notNull().default("1"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
  pdfUrl: true,
  pdfPageCount: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const annotations = pgTable("annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  pageNumber: text("page_number").notNull(),
  data: jsonb("data").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertAnnotationSchema = createInsertSchema(annotations).pick({
  projectId: true,
  pageNumber: true,
  data: true,
});

export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotations.$inferSelect;

export const annotationLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const annotationSignupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type AnnotationShape = {
  id: string;
  type: 'rect' | 'circle' | 'line' | 'arrow' | 'freehand' | 'text' | 'measurement' | 'angle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  fontSize?: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  measurementValue?: number;
  measurementUnit?: 'mm' | 'cm' | 'ft';
  visible: boolean;
  locked: boolean;
  name: string;
};

export type LayerData = {
  id: string;
  name: string;
  type: 'pdf' | 'annotation' | 'measurement';
  visible: boolean;
  locked: boolean;
  shapes: AnnotationShape[];
};

export type PageAnnotations = {
  pageNumber: number;
  layers: LayerData[];
  scale: number;
};
