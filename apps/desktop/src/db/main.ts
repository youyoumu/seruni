import { access, cp } from "node:fs/promises";
import { basename, join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "#/env";
import { log } from "#/util/logger";
import type { VadData } from "#/util/schema";
import { mediaTable, notesTable } from "./schema";

hmr.log(import.meta);

class DB {
  db: ReturnType<typeof drizzle>;
  constructor() {
    this.db = drizzle(`file:${env.DB_FILE_PATH}`);
  }

  static async migrate(db: ReturnType<typeof drizzle>) {
    //TODO: enum namespace
    log.debug({ namespace: "DB" }, "Migrating database");
    await migrate(db, {
      migrationsFolder: env.DRIZZLE_PATH,
    });
  }

  async insertNoteAndMedia({
    noteId,
    media,
  }: {
    noteId: number;
    media: Array<{
      type: "picture" | "sentenceAudio";
      filePath: string;
      vadData: VadData | undefined;
    }>;
  }) {
    media.forEach((m) => {
      cp(m.filePath, join(env.STORAGE_PATH, basename(m.filePath)));
    });

    const insertedNotes = await this.db
      .insert(notesTable)
      .values({ noteId })
      .onConflictDoNothing({ target: notesTable.noteId })
      .returning({ id: notesTable.id });
    const noteRowId = insertedNotes[0]?.id;
    if (!noteRowId) throw new Error("Note ID not found");

    log.debug({ noteId, media }, "Saving note and media to database");
    await this.db.insert(mediaTable).values(
      media.map((m) => ({
        noteId: noteRowId,
        type: m.type,
        fileName: basename(m.filePath),
        vadData: m.vadData,
      })),
    );
  }

  async getNoteMedia(noteId: number) {
    const result = await this.db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.noteId, noteId));
    const validMedia: number[] = [];
    for (const r of result) {
      try {
        await access(join(env.STORAGE_PATH, r.fileName));
        validMedia.push(r.id);
      } catch {}
    }
    return result.filter((r) => validMedia.includes(r.id));
  }
}

export const mainDB = hmr.module(new DB());

await DB.migrate(mainDB().db);

//  ───────────────────────────────── HMR ─────────────────────────────────

type Self = typeof import("./main");
const module: Self = { mainDB };
if (import.meta.hot) {
  hmr.register<Self>(import.meta, module);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
  });
}
