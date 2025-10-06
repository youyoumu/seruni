import Dexie, { type EntityTable } from "dexie";

type Text = {
  id: number;
  text: string;
  uuid: string;
};

const texthoookerDB = new Dexie("TexthookerDB") as Dexie & {
  text: EntityTable<Text, "id">;
};

texthoookerDB.version(1).stores({
  text: "++id, text, uuid",
});

export { texthoookerDB };
