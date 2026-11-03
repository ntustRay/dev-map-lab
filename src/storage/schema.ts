import { z } from "zod";
import { languageSchema } from "../core/content-schema";
import { gradeResultSchema } from "../core/grade";

export const anchorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page") }),
  z.object({ kind: z.literal("block"), blockId: z.string().min(1) }),
  z.object({
    kind: z.literal("selection"),
    blockId: z.string().min(1),
    quote: z.string().min(1),
    prefix: z.string(),
    suffix: z.string(),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  }),
]);
export type NoteAnchor = z.infer<typeof anchorSchema>;
export const noteSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  lessonVersion: z.number().int().positive(),
  anchor: anchorSchema,
  body: z.string().max(100000),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type Note = z.infer<typeof noteSchema>;
export const attemptSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  questionId: z.string().min(1),
  questionVersion: z.number().int().positive(),
  graderVersion: z.literal("1"),
  answer: z.string().max(100000),
  grade: gradeResultSchema,
  createdAt: z.number().int().min(0),
});
export type Attempt = z.infer<typeof attemptSchema>;
export const progressSchema = z.object({
  lessonId: z.string().min(1),
  read: z.boolean(),
  updatedAt: z.number().int().min(0),
});
export type Progress = z.infer<typeof progressSchema>;
export const draftSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  questionVersion: z.number().int().positive(),
  language: languageSchema,
  source: z.string().max(50000),
  updatedAt: z.number().int().min(0),
});
export type Draft = z.infer<typeof draftSchema>;
export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  notes: z.array(noteSchema).max(10000),
  attempts: z.array(attemptSchema).max(100000),
  progress: z.array(progressSchema).max(10000),
  drafts: z.array(draftSchema).max(10000),
});
export type Backup = z.infer<typeof backupSchema>;
