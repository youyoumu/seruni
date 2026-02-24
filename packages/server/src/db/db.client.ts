import fs from "node:fs/promises";
import path from "node:path";

import type { State } from "#/state/state";
import { errFrom } from "#/util/err";
import type { VadData } from "#/util/schema";
import { notes as notesTable, media as mediaTable } from "@repo/shared/db";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { ok, type Result } from "neverthrow";
import type { Logger } from "pino";

import type { DB } from ".";

export type MediaList = Array<{
  type: "picture" | "sentenceAudio";
  filePath: string;
  vadData?: VadData;
}>;

export class DBClient {
  db: DB;
  log: Logger;
  state: State;

  constructor(opts: { db: DB; logger: Logger; state: State }) {
    this.db = opts.db;
    this.log = opts.logger.child({ name: "db-client" });
    this.state = opts.state;
  }

  async migrate() {
    this.log.debug("Migrating database");
    await migrate(this.db, {
      migrationsFolder: this.state.path().drizzleDir,
    });
  }

  async insertNoteAndMedia({
    noteId,
    media,
  }: {
    noteId: number;
    media: MediaList;
  }): Promise<Result<null, Error>> {
    media.forEach((m) => {
      this.log.trace(`Copying ${m.filePath} to ${this.state.path().storageDir}`);
      fs.cp(m.filePath, path.join(this.state.path().storageDir, path.basename(m.filePath)));
    });

    const insertedNotes = await this.db
      .insert(notesTable)
      .values({ noteId })
      .onConflictDoNothing({ target: notesTable.noteId })
      .returning();
    let noteRowId = insertedNotes[0]?.id;
    if (!noteRowId) {
      noteRowId = await this.db
        .select()
        .from(notesTable)
        .where(eq(notesTable.noteId, noteId))
        .then((result) => result[0]?.id);
      if (!noteRowId) return errFrom(`Can't find note with nodeId ${noteId}`);
    }

    this.log.debug({ noteId, media }, "Saving note and media to database");
    await this.db.insert(mediaTable).values(
      media.map((m) => ({
        noteId: noteRowId,
        type: m.type,
        fileName: path.basename(m.filePath),
        vadData: m.vadData,
      })),
    );
    return ok(null);
  }

  async getNoteMedia(noteId: number) {
    const note = await this.db.select().from(notesTable).where(eq(notesTable.noteId, noteId));
    const noteRowId = note[0]?.id;
    if (!noteRowId) {
      this.log.trace(`noteId ${noteId} is not in the database`);
      return [];
    }
    const result = await this.db.select().from(mediaTable).where(eq(mediaTable.noteId, noteRowId));
    const validMedia: number[] = [];
    for (const r of result) {
      try {
        await fs.access(path.join(this.state.path().storageDir, r.fileName));
        validMedia.push(r.id);
      } catch {}
    }
    return result
      .filter((r) => validMedia.includes(r.id))
      .map((item) => ({
        ...item,
        filePath: path.join(this.state.path().storageDir, item.fileName),
      }));
  }

  async deleteNoteMedia(fileName: string) {
    const deleted = await this.db
      .delete(mediaTable)
      .where(eq(mediaTable.fileName, fileName))
      .returning();
    this.log.debug({ deleted }, "Deleted note media from database");
    await fs.rm(path.join(this.state.path().storageDir, fileName));
    this.log.trace(`Deleted ${fileName} from ${this.state.path().storageDir}`);
    const noteRowIds = deleted.map((d) => d.noteId);
    const notes = await this.db.select().from(notesTable).where(inArray(notesTable.id, noteRowIds));
    return notes;
  }
}
