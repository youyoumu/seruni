import path from "node:path";

import type { State } from "#/state/state";
import { safeAccess, safeCp, safeRm } from "#/util/fs";
import { anyFail } from "#/util/result";
import type { VadData } from "#/util/schema";
import { R } from "@praha/byethrow";
import { notes as notesTable, media as mediaTable } from "@repo/shared/db";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Logger } from "pino";

import type { DB } from ".";

export type MediaList = Array<{
  type: "picture" | "sentenceAudio";
  filePath: string;
  vadData?: VadData;
}>;

export class DBClient {
  log: Logger;

  constructor(
    public db: DB,
    public logger: Logger,
    public state: State,
  ) {
    this.log = logger.child({ name: "db-client" });
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
  }): Promise<R.Result<null, Error>> {
    media.forEach((m) => {
      this.log.trace(`Copying ${m.filePath} to ${this.state.path().storageDir}`);
      void safeCp(m.filePath, path.join(this.state.path().storageDir, path.basename(m.filePath)));
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
      if (!noteRowId) return anyFail(`Can't find note with nodeId ${noteId}`);
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
    return R.succeed(null);
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
      await R.pipe(
        safeAccess(path.join(this.state.path().storageDir, r.fileName)),
        R.inspect(() => validMedia.push(r.id)),
      );
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
    await R.pipe(
      safeRm(path.join(this.state.path().storageDir, fileName)),
      R.inspect(() => this.log.trace(`Deleted ${fileName} from ${this.state.path().storageDir}`)),
    );
    const noteRowIds = deleted.map((d) => d.noteId);
    const notes = await this.db.select().from(notesTable).where(inArray(notesTable.id, noteRowIds));
    return notes;
  }
}
